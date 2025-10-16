// file: supabase/functions/fetch-option-prices/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.beursduivel.be";
const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Edge Function)",
  "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
};

interface OptionHolding {
  isin: string;
  product: string; // e.g. "AH C35.00 21NOV25"
}
interface ScrapedOption {
  type: "Call" | "Put";
  expiry: string; // e.g. "Oktober 2025 (AEX / AH)"
  strike: string; // e.g. "36,500"  (comma decimal)
  issueId: string; // e.g. "523396658"
  url: string; // absolute page URL
}

function cleanHref(href: string): string {
  // normalize ../../../ paths into absolute URLs
  const normalized = href.replace(/\.\.\/\.\.\//g, "/");
  const url = new URL(normalized, BASE_URL);
  return url.toString();
}

function toCommaDecimal(s: string): string {
  // ensure "35.00" -> "35,00", "35,00" stays "35,00"
  return s.includes(",") ? s : s.replace(".", ",");
}

function onlyLeadingNumber(txt: string | null | undefined): string {
  // Grab ONLY the first number (with optional thousands/decimal comma/dot)
  // e.g. "36,000   <small>17 okt</small>" -> "36,000"
  // e.g. "36.50" -> "36.50"
  if (!txt) return "";
  const m = txt
    .replace(/\s+/g, " ")
    .trim()
    .match(/^([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/);
  return m ? m[1] : "";
}

async function fetchOptionChain(): Promise<ScrapedOption[]> {
  const url = `${BASE_URL}/Aandeel-Koers/11755/Ahold-Delhaize-Koninklijke/opties-expiratiedatum.aspx`;
  console.log(`Fetching option chain from ${url} ...`);
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`Failed to fetch option chain (${response.status})`);
  const html = await response.text();

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("Failed to parse beursduivel HTML");

  const options: ScrapedOption[] = [];
  for (const section of doc.querySelectorAll("section.contentblock")) {
    const expiry =
      (section as Element).querySelector("h3.titlecontent")?.textContent?.replace(/\s+/g, " ").trim() ??
      "Unknown Expiry";

    for (const row of (section as Element).querySelectorAll("tr")) {
      const strikeRaw = onlyLeadingNumber((row as Element).querySelector(".optiontable__focus")?.textContent);
      if (!strikeRaw) continue;

      // Standardize strike as comma decimal for comparison
      const normalizedStrike = toCommaDecimal(strikeRaw);

      for (const optType of ["Call", "Put"] as const) {
        const link = (row as Element).querySelector(`a.optionlink.${optType}`);
        if (!link) continue;
        const href = link.getAttribute("href");
        if (!href) continue;

        const idMatch = href.match(/\/(\d+)\//);
        const issueId = idMatch ? idMatch[1] : null;
        if (!issueId) continue;

        options.push({
          type: optType,
          expiry,
          strike: normalizedStrike,
          issueId,
          url: cleanHref(href),
        });
      }
    }
  }
  console.log(`Scraped ${options.length} options`);
  return options;
}

async function getLivePrice(option: ScrapedOption): Promise<number | null> {
  const response = await fetch(option.url, { headers: HEADERS });
  if (!response.ok) {
    console.warn(`Failed to fetch price page for ${option.issueId}: ${response.status}`);
    return null;
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  const el = doc.querySelector(`span[id="${option.issueId}LastPrice"]`);
  if (!el?.textContent) {
    console.warn(`Price element not found for ${option.issueId} on detail page`);
    return null;
  }

  const priceText = el.textContent.trim().replace(",", ".");
  const price = parseFloat(priceText);
  if (Number.isNaN(price)) {
    console.warn(`Invalid price "${el.textContent.trim()}" for ${option.issueId}`);
    return null;
  }

  console.log(`Fetched live price for ${option.issueId}: ${price}`);
  return price;
}

/**
 * Parse a holding string from frontend. Primary format:
 *   "AH C35.00 21NOV25"
 *   "AH P38.00 21NOV25"
 * Also supports compact/loose whitespace & optional AH9.
 * Fallback: verbose "AHOLD DELHAIZE CALL 38.00 17-11-2025"
 */
function matchOptionToHolding(holding: OptionHolding): { strike: string; expiry: string; type: "Call" | "Put" } | null {
  const raw = (holding.product ?? "").toString();
  // normalize whitespace
  const product = raw.replace(/\s+/g, " ").trim();

  // Debug: uncomment when you need to hunt hidden chars
  // console.warn(`RAW PRODUCT STRING: [${product}] len=${product.length}`);
  // console.warn(`CODES:`, Array.from(product).map(c => c.charCodeAt(0)));

  // Primary compact pattern: "AH C35.00 21NOV25" or "AH9 P38.00 05OCT26"
  // Groups: [1]=C|P, [2]=strike, [3]=day, [4]=MMM, [5]=YY
  const compact = /^(?:AH|AH9)\s+([CP])\s*([\d]+(?:[.,]\d+)?)\s+(\d{1,2})([A-Za-z]{3})(\d{2})$/i;
  let m = product.match(compact);

  let type: "Call" | "Put";
  let strike: string;
  let expiry: string;

  if (m) {
    const [, typeLetter, strikeRaw, _day, monthAbbr, yearShort] = m;
    type = typeLetter.toUpperCase() === "C" ? "Call" : "Put";
    strike = toCommaDecimal(strikeRaw);

    const monthMap: Record<string, string> = {
      JAN: "Januari",
      FEB: "Februari",
      MAR: "Maart",
      APR: "April",
      MAY: "Mei",
      JUN: "Juni",
      JUL: "Juli",
      AUG: "Augustus",
      SEP: "September",
      OCT: "Oktober",
      NOV: "November",
      DEC: "December",
    };
    const month = monthMap[monthAbbr.toUpperCase()] || monthAbbr;
    const year = `20${yearShort}`;
    expiry = `${month} ${year}`;
    return { strike, expiry, type };
  }

  // Fallback verbose pattern:
  // "AHOLD DELHAIZE CALL 38.00 17-11-2025"
  // Groups: [1]=CALL|PUT, [2]=strike, [3]=dd, [4]=mm, [5]=yyyy
  const verbose = /AHOLD\s+DELHAIZE\s+(CALL|PUT)\s+([\d]+(?:[.,]\d+)?)\s+(\d{1,2})-(\d{1,2})-(\d{4})/i;
  m = product.match(verbose);
  if (m) {
    const [, tWord, strikeRaw, _d, mm, yyyy] = m;
    type = tWord.toUpperCase() === "CALL" ? "Call" : "Put";
    strike = toCommaDecimal(strikeRaw);

    const monthNames = [
      "Januari",
      "Februari",
      "Maart",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Augustus",
      "September",
      "Oktober",
      "November",
      "December",
    ];
    const monthIdx = Math.max(0, Math.min(11, parseInt(mm, 10) - 1));
    expiry = `${monthNames[monthIdx]} ${yyyy}`;
    return { strike, expiry, type };
  }

  console.warn(`Could not parse option from product: ${product}`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { holdings } = await req.json();
    if (!Array.isArray(holdings) || holdings.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No holdings provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Fetching prices for ${holdings.length} holdings...`);
    const scrapedOptions = await fetchOptionChain();
    const results: Array<
      { product: string; status: "success"; price: number } | { product: string; status: "failed"; reason: string }
    > = [];

    for (const holding of holdings) {
      const parsed = matchOptionToHolding(holding);
      if (!parsed) {
        results.push({ product: holding.product, status: "failed", reason: "parse error" });
        continue;
      }

      // We match by: type + strike (comma-decimal) + month+year presence in section header
      const match = scrapedOptions.find(
        (opt) =>
          opt.type === parsed.type &&
          opt.strike === parsed.strike &&
          (opt.expiry.includes(parsed.expiry) || // "November 2025" in "November 2025 (AEX / AH)"
            opt.expiry.startsWith(parsed.expiry)), // extra guard
      );

      if (!match) {
        console.warn(
          `No match found for ${holding.product} (parsed: ${parsed.type} ${parsed.strike} ${parsed.expiry})`,
        );
        // Helpful: dump a few close candidates for debugging
        const near = scrapedOptions
          .filter((o) => o.type === parsed.type && o.expiry.includes(parsed.expiry))
          .slice(0, 3)
          .map((o) => ({ strike: o.strike, expiry: o.expiry }));
        console.warn(`Nearby candidates: ${JSON.stringify(near)}`);
        results.push({ product: holding.product, status: "failed", reason: "no match found" });
        continue;
      }

      const price = await getLivePrice(match);
      if (price == null) {
        results.push({ product: holding.product, status: "failed", reason: "no price found" });
        continue;
      }

      results.push({ product: holding.product, status: "success", price });
      // gentle throttle
      await new Promise((r) => setTimeout(r, 350));
    }

    // 🔒 Supabase auth + upsert
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid authorization token");

    const successes = results.filter(
      (r): r is { product: string; status: "success"; price: number } => r.status === "success",
    );

    for (const r of successes) {
      const holding = holdings.find((h) => h.product === r.product);
      if (!holding) continue;

      const { error: upsertError } = await supabase.from("current_prices").upsert(
        {
          user_id: user.id,
          isin: holding.isin,
          current_price: r.price,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,isin" },
      );

      if (upsertError) {
        console.error(`Database update failed for ${r.product}:`, upsertError);
      }
    }

    console.log(`Successfully fetched ${successes.length}/${holdings.length} prices`);
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});

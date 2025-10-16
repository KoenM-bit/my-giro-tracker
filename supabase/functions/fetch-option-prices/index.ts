// file: supabase/functions/fetch-option-prices/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.beursduivel.be";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Edge Function)" };

interface OptionHolding {
  isin: string;
  product: string;
}
interface ScrapedOption {
  type: string;
  expiry: string;
  strike: string;
  issueId: string;
  url: string;
}

// ---------- helpers ----------
function cleanHref(href: string): string {
  const normalized = href.replace(/\.\.\/\.\.\//g, "/");
  const url = new URL(normalized, BASE_URL);
  return url.toString();
}

function normalizeProductString(s: string): string {
  return s
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const monthMap: Record<string, string> = {
  JAN: "Januari",
  FEB: "Februari",
  MAR: "Maart",
  APR: "April",
  MAY: "Mei",
  MAI: "Mei",
  JUN: "Juni",
  JUL: "Juli",
  AUG: "Augustus",
  SEP: "September",
  OCT: "Oktober",
  OKT: "Oktober",
  NOV: "November",
  DEC: "December",
};

async function fetchOptionChain(): Promise<ScrapedOption[]> {
  try {
    const url = `${BASE_URL}/Aandeel-Koers/11755/Ahold-Delhaize-Koninklijke/opties-expiratiedatum.aspx`;
    console.log(`Fetching option chain from ${url} ...`);
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch option chain (${response.status})`);
    const html = await response.text();

    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) throw new Error("Failed to parse beursduivel HTML");

    const options: ScrapedOption[] = [];
    for (const section of doc.querySelectorAll("section.contentblock")) {
      const expiry = (section as Element).querySelector("h3.titlecontent")?.textContent?.trim() ?? "Unknown Expiry";
      for (const row of (section as Element).querySelectorAll("tr")) {
        const strike = (row as Element).querySelector(".optiontable__focus")?.textContent?.trim().split(/\s+/)[0] ?? "";
        if (!strike) continue;

        for (const optType of ["Call", "Put"]) {
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
            strike,
            issueId,
            url: cleanHref(href),
          });
        }
      }
    }

    console.log("Scraped", options.length, "options");
    const sample = options.slice(0, 5).map((o) => ({
      expiry: o.expiry,
      type: o.type,
      strike: o.strike,
      issueId: o.issueId,
    }));
    console.log("SCRAPER SAMPLE:", JSON.stringify(sample));

    const novOptions = options.filter((o) => o.expiry.includes("November 2025"));
    console.log(`Found ${novOptions.length} November 2025 options`);
    if (novOptions.length > 0) {
      console.log("November 2025 samples:", JSON.stringify(novOptions.slice(0, 10)));
    }

    return options;
  } catch (err) {
    console.error("fetchOptionChain error:", err);
    return [];
  }
}

async function getLivePrice(option: ScrapedOption): Promise<number | null> {
  const response = await fetch(option.url, { headers: HEADERS });
  if (!response.ok) {
    console.warn(`Failed to fetch price for ${option.issueId}: ${response.status}`);
    return null;
  }
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  const el = doc.querySelector(`span[id="${option.issueId}LastPrice"]`);
  if (!el?.textContent) return null;

  const priceText = el.textContent.trim().replace(",", ".");
  const price = parseFloat(priceText);
  if (isNaN(price)) return null;

  console.log(`Fetched live price for ${option.issueId}: ${price}`);
  return price;
}

function matchOptionToHolding(holding: OptionHolding) {
  const raw = holding.product ?? "";
  const product = normalizeProductString(raw);
  const upper = product.toUpperCase();

  const compact = /^(?:AH|AH9)\s+([CP])\s*([0-9]+(?:[.,][0-9]+)?)\s+([0-9]{1,2})([A-Z]{3})([0-9]{2})$/i;
  const long = /AHOLD\s+DELHAIZE\s+(CALL|PUT)\s+([0-9]+(?:[.,][0-9]+)?)\s+([0-9]{2})-([0-9]{2})-([0-9]{4})/i;

  let type = "";
  let strike = "";
  let expiry = "";

  let m = upper.match(compact);
  if (m) {
    const [, typeLetter, strikeRaw, day, monAbbr, yy] = m;
    type = typeLetter.toUpperCase() === "C" ? "Call" : "Put";
    strike = strikeRaw.replace(",", ".").replace(".", ",");
    const monthName = monthMap[monAbbr] ?? monAbbr;
    expiry = `${monthName} 20${yy}`;
    console.log(
      `Parsed (compact): raw=[${raw}] normalized=[${product}] -> { type:${type}, strike:${strike}, expiry:${expiry} }`,
    );
    return { type, strike, expiry };
  }

  m = product.match(long);
  if (m) {
    const [, typeWord, strikeRaw, , mm, yyyy] = m;
    type = typeWord[0].toUpperCase() + typeWord.slice(1).toLowerCase();
    strike = strikeRaw.replace(",", ".").replace(".", ",");
    const monthIdx = parseInt(mm, 10) - 1;
    const months = [
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
    expiry = `${months[monthIdx]} ${yyyy}`;
    console.log(
      `Parsed (long): raw=[${raw}] normalized=[${product}] -> { type:${type}, strike:${strike}, expiry:${expiry} }`,
    );
    return { type, strike, expiry };
  }

  console.warn(`Could not parse option from product: ${raw}`);
  console.warn(`RAW=[${raw}] | NORMALIZED=[${product}]`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const holdings: OptionHolding[] = Array.isArray(body?.holdings) ? body.holdings : [];
    console.log(`Edge fn fetch-option-prices: received ${holdings.length} holdings`);

    if (!holdings.length) {
      return new Response(JSON.stringify({ success: false, error: "No holdings provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const scrapedOptions = await fetchOptionChain();

    const results: Array<
      { product: string; status: "success"; price: number } | { product: string; status: "failed"; reason: string }
    > = [];

    // ✅ helper once, outside loop
    function normalizeStrike(strike: string): number {
      return parseFloat(strike.replace(",", "."));
    }

    for (const holding of holdings) {
      const parsed = matchOptionToHolding(holding);
      if (!parsed) {
        results.push({ product: holding.product, status: "failed", reason: "parse error" });
        continue;
      }

      const candidates = scrapedOptions.filter((o) => o.expiry.startsWith(parsed.expiry));

      console.log(
        `Looking for: ${parsed.type} ${parsed.strike} ${parsed.expiry} — ${candidates.length} candidates found`,
      );

      const match = candidates.find((opt) => {
        const sameType = opt.type === parsed.type;
        const strikeDiff = Math.abs(normalizeStrike(opt.strike) - normalizeStrike(parsed.strike));
        return sameType && strikeDiff < 0.001;
      });

      if (!match) {
        console.warn(
          `❌ No match found on beursduivel for ${holding.product} -> {${parsed.type} ${parsed.strike} ${parsed.expiry}}`,
        );
        console.warn(`Closest candidates for ${parsed.expiry}:`, JSON.stringify(candidates.slice(0, 10)));
        results.push({ product: holding.product, status: "failed", reason: "no match found" });
        continue;
      }

      console.log(`✅ Matched ${parsed.type} ${parsed.strike} → issueId ${match.issueId} (${match.expiry})`);

      const price = await getLivePrice(match);
      if (price == null) {
        results.push({ product: holding.product, status: "failed", reason: "no price found" });
        continue;
      }

      results.push({ product: holding.product, status: "success", price });
      await new Promise((r) => setTimeout(r, 350));
    }

    const summary = {
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
      details: results,
    };

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("Missing Authorization header (prices will be returned but not stored)");
    } else if (summary.successful > 0) {
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

      if (userError || !user) {
        console.warn("Invalid authorization token; skipping DB upserts");
      } else {
        for (const r of results.filter((x) => x.status === "success") as Array<{ product: string; price: number }>) {
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
            console.error(`Database update failed for ${holding.product}:`, upsertError);
          }
        }
      }
    }

    console.log(`Successfully fetched ${summary.successful}/${holdings.length} prices`);
    return new Response(JSON.stringify({ success: true, summary, results }), {
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

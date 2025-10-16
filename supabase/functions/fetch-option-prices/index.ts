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

/**
 * Normalize relative URLs like ../../../Optie-Koers/... into absolute
 */
function cleanHref(href: string): string {
  const normalized = href.replace(/\.\.\/\.\.\//g, "/");
  const url = new URL(normalized, BASE_URL);
  return url.toString();
}

/**
 * Scrape all available Ahold Delhaize options from beursduivel
 */
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
  console.log(`Scraped ${options.length} options`);
  return options;
}

/**
 * Fetch live price from the option detail page
 */
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

/**
 * Parse a holding like:
 *  AH C35.00 21NOV25
 *  AH P38.00 21NOV25
 *  AHOLD DELHAIZE CALL 38.00 17-11-2025
 */
function matchOptionToHolding(holding: OptionHolding) {
  const product = holding.product.trim();

  // Expect format: AH C35.00 21NOV25 or AH P38.00 21NOV25
  const pattern = /^AH\s+([CP])\s*([\d.]+)\s+(\d{1,2})([A-Z]{3})(\d{2})$/i;
  const match = product.match(pattern);
  if (!match) {
    console.warn(`Could not parse option from product: ${product}`);
    console.warn(`RAW PRODUCT STRING: [${product}]`);
    return null;
  }

  const [, typeLetter, strikeRaw, , monthAbbr, yearShort] = match;
  const type = typeLetter.toUpperCase() === "C" ? "Call" : "Put";
  const strike = strikeRaw.replace(".", ",");

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

  const expiry = `${month} ${year}`;
  return { strike, expiry, type };
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
    const results: any[] = [];

    for (const holding of holdings) {
      const parsed = matchOptionToHolding(holding);
      if (!parsed) {
        results.push({ product: holding.product, status: "failed", reason: "parse error" });
        continue;
      }

      const match = scrapedOptions.find(
        (opt) => opt.strike === parsed.strike && opt.expiry.includes(parsed.expiry) && opt.type === parsed.type,
      );

      if (!match) {
        console.warn(`No match found for ${holding.product}`);
        results.push({ product: holding.product, status: "failed", reason: "no match found" });
        continue;
      }

      const price = await getLivePrice(match);
      if (price == null) {
        results.push({ product: holding.product, status: "failed", reason: "no price found" });
        continue;
      }

      results.push({ product: holding.product, status: "success", price });
      await new Promise((r) => setTimeout(r, 400)); // gentle throttle
    }

    // 🔒 Supabase authentication & DB update
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

    const updates = results.filter((r) => r.status === "success");
    for (const u of updates) {
      const holding = holdings.find((h) => h.product === u.product);
      if (!holding) continue;

      const { error: upsertError } = await supabase.from("current_prices").upsert(
        {
          user_id: user.id,
          isin: holding.isin,
          current_price: u.price,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,isin" },
      );

      if (upsertError) {
        console.error(`Database update failed for ${holding.product}:`, upsertError);
      }
    }

    console.log(`Successfully fetched ${updates.length}/${holdings.length} prices`);
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
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

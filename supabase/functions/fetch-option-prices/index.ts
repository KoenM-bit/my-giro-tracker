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

// ---------- scrape option chain ----------
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
    const novOptions = options.filter((o) => o.expiry.includes("November 2025"));
    if (novOptions.length > 0) {
      console.log(`Found ${novOptions.length} November 2025 options`);
    }

    return options;
  } catch (err) {
    console.error("fetchOptionChain error:", err);
    return [];
  }
}

// ---------- new getLivePrice ----------
async function getLivePrice(option: ScrapedOption): Promise<number | null> {
  try {
    const response = await fetch(option.url, { headers: HEADERS });
    if (!response.ok) {
      console.warn(`Failed to fetch price for ${option.issueId}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return null;

    // Zoek tabelrij met deze issueId
    const rows = doc.querySelectorAll("tr");
    for (const row of rows) {
      const link = (row as Element).querySelector(`a.optionlink.${option.type}`);
      if (!link) continue;
      const href = link.getAttribute("href") ?? "";
      if (!href.includes(option.issueId)) continue;

      // Haal bid/ask uit de juiste kolommen
      const bidSelector = option.type === "Call" ? ".optiontable__bidcall" : ".optiontable__bid";
      const askSelector = option.type === "Call" ? ".optiontable__askcall" : ".optiontable__askput";

      const bidText = (row as Element).querySelector(bidSelector)?.textContent?.trim().replace(",", ".") ?? "";
      const askText = (row as Element).querySelector(askSelector)?.textContent?.trim().replace(",", ".") ?? "";

      const bid = parseFloat(bidText);
      const ask = parseFloat(askText);

      if (!isNaN(bid) && !isNaN(ask)) {
        const mid = (bid + ask) / 2;
        console.log(`📈 ${option.type} ${option.strike} -> Bid=${bid}, Ask=${ask}, Mid=${mid}`);
        return mid;
      } else {
        console.warn(`⚠️ Missing bid/ask for ${option.issueId}, falling back to last price`);
      }
    }

    // fallback: last price
    const el = doc.querySelector(`span[id="${option.issueId}LastPrice"]`);
    if (el?.textContent) {
      const priceText = el.textContent.trim().replace(",", ".");
      const price = parseFloat(priceText);
      if (!isNaN(price)) {
        console.log(`Fallback last price for ${option.issueId}: ${price}`);
        return price;
      }
    }

    return null;
  } catch (err) {
    console.error(`Error in getLivePrice(${option.issueId}):`, err);
    return null;
  }
}

// ---------- matchOptionToHolding ----------
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
    return { type, strike, expiry };
  }

  return null;
}

// ---------- main function ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const holdings: OptionHolding[] = Array.isArray(body?.holdings) ? body.holdings : [];
    console.log(`Edge fn fetch-option-prices: received ${holdings.length} holdings`);

    const scrapedOptions = await fetchOptionChain();
    const results: any[] = [];

    function normalizeStrike(strike: string): number {
      return parseFloat(strike.replace(",", "."));
    }
    function normalizeExpiry(exp: string): string {
      return exp
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, "")
        .trim();
    }

    for (const holding of holdings) {
      const parsed = matchOptionToHolding(holding);
      if (!parsed) {
        results.push({ product: holding.product, status: "failed", reason: "parse error" });
        continue;
      }

      const parsedExpiry = normalizeExpiry(parsed.expiry);
      const candidates = scrapedOptions.filter((o) => normalizeExpiry(o.expiry) === parsedExpiry);
      const match = candidates.find((opt) => {
        const sameType = opt.type === parsed.type;
        const parsedStrikeNum = normalizeStrike(parsed.strike);
        const optStrikeNum = normalizeStrike(opt.strike);
        return sameType && Math.abs(optStrikeNum - parsedStrikeNum) < 0.001;
      });

      if (!match) {
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

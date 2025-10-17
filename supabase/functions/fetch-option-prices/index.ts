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
  bid: number | null;
  ask: number | null;
}

// ---------- helpers ----------
function cleanHref(href: string): string {
  const normalized = href.replace(/\.\.\/\.\.\//g, "/");
  const url = new URL(normalized, BASE_URL);
  return url.toString();
}

function parseEUFloat(str: string | null): number | null {
  if (!str) return null;
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
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

        const bidCall = (row as Element).querySelector(".optiontable__bidcall")?.textContent?.trim() ?? "";
        const askCall = (row as Element).querySelector(".optiontable__askcall")?.textContent?.trim() ?? "";
        const bidPut = (row as Element).querySelector(".optiontable__bid")?.textContent?.trim() ?? "";
        const askPut = (row as Element).querySelector(".optiontable__askput")?.textContent?.trim() ?? "";

        for (const optType of ["Call", "Put"]) {
          const link = (row as Element).querySelector(`a.optionlink.${optType}`);
          if (!link) continue;
          const href = link.getAttribute("href");
          if (!href) continue;

          const idMatch = href.match(/\/(\d+)\//);
          const issueId = idMatch ? idMatch[1] : null;
          if (!issueId) continue;

          const bidVal = optType === "Call" ? parseEUFloat(bidCall) : parseEUFloat(bidPut);
          const askVal = optType === "Call" ? parseEUFloat(askCall) : parseEUFloat(askPut);

          options.push({
            type: optType,
            expiry,
            strike,
            issueId,
            url: cleanHref(href),
            bid: bidVal,
            ask: askVal,
          });
        }
      }
    }

    console.log("Scraped", options.length, "options total");
    const expiries = Array.from(new Set(options.map((o) => o.expiry)));
    console.log("Distinct expiries found:", expiries);
    return options;
  } catch (err) {
    console.error("fetchOptionChain error:", err);
    return [];
  }
}

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

    // Zoek de tabelrij die deze optie representeert
    const rows = doc.querySelectorAll("tr");
    for (const row of rows) {
      const link = (row as Element).querySelector(`a.optionlink.${option.type}`);
      if (!link) continue;
      const href = link.getAttribute("href") ?? "";
      if (!href.includes(option.issueId)) continue;

      // pak bid/ask kolommen
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

    // Fallback: probeer "last price" span
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

function matchOptionToHolding(holding: OptionHolding) {
  const raw = holding.product ?? "";
  const product = normalizeProductString(raw);
  const upper = product.toUpperCase();

  const compact = /^(?:AH|AH9)\s+([CP])\s*([0-9]+(?:[.,][0-9]+)?)\s+([0-9]{1,2})([A-Z]{3})([0-9]{2})$/i;

  const long = /AHOLD\s+DELHAIZE\s+(CALL|PUT)\s+([0-9]+(?:[.,][0-9]+)?)\s+([0-9]{2})-([0-9]{2})-([0-9]{4})/i;
  let type = "",
    strike = "",
    expiry = "";

  let m = upper.match(compact);
  if (m) {
    const [, typeLetter, strikeRaw, , monAbbr, yy] = m;
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
    expiry = `${months[parseInt(mm, 10) - 1]} ${yyyy}`;
    return { type, strike, expiry };
  }

  console.warn(`Could not parse option from product: ${raw}`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const holdings: OptionHolding[] = Array.isArray(body?.holdings) ? body.holdings : [];
    if (!holdings.length) {
      return new Response(JSON.stringify({ success: false, error: "No holdings provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const scraped = await fetchOptionChain();

    const results: any[] = [];
    function normalizeStrike(s: string) {
      return parseFloat(s.replace(",", "."));
    }
    function normalizeExpiry(s: string) {
      return s
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, "")
        .trim();
    }

    for (const h of holdings) {
      const parsed = matchOptionToHolding(h);
      if (!parsed) {
        results.push({ product: h.product, status: "failed", reason: "parse error" });
        continue;
      }

      const expiryNorm = normalizeExpiry(parsed.expiry);
      const candidates = scraped.filter((o) => normalizeExpiry(o.expiry) === expiryNorm);
      const match = candidates.find(
        (o) => o.type === parsed.type && Math.abs(normalizeStrike(o.strike) - normalizeStrike(parsed.strike)) < 0.001,
      );

      if (!match) {
        results.push({ product: h.product, status: "failed", reason: "no match found" });
        continue;
      }

      let final = null;
      let source = "none";

      if (match.bid && match.ask) {
        final = (match.bid + match.ask) / 2;
        source = "bid/ask";
      } else if (match.bid) {
        final = match.bid;
        source = "bid";
      } else if (match.ask) {
        final = match.ask;
        source = "ask";
      }

      if (!final) {
        const live = await getLivePrice(match);
        if (live) {
          final = live;
          source = "live";
        }
      }

      if (!final) {
        results.push({ product: h.product, status: "failed", reason: "no price found" });
      } else {
        results.push({ product: h.product, status: "success", price: final, source });
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    const summary = {
      total: holdings.length,
      success: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
      details: results,
    };

    console.log(`✅ Finished fetching: ${summary.success}/${holdings.length} success`);
    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

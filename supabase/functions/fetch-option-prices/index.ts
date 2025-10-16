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

function cleanHref(href: string): string {
  // normalize ../../../ paths
  const normalized = href.replace(/\.\.\/\.\.\//g, "/");
  const url = new URL(normalized, BASE_URL);
  return url.toString();
}

async function fetchOptionChain(): Promise<ScrapedOption[]> {
  const url = `${BASE_URL}/Aandeel-Koers/11755/Ahold-Delhaize-Koninklijke/opties-expiratiedatum.aspx`;
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`Fetch option chain failed (${response.status})`);
  const html = await response.text();

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("DOM parsing failed");

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

async function getLivePrice(option: ScrapedOption): Promise<number | null> {
  // use real URL from scraped option
  const response = await fetch(option.url, { headers: HEADERS });
  if (!response.ok) {
    console.warn(`Price fetch failed (${response.status}) for ${option.issueId}`);
    return null;
  }
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;
  const el = doc.querySelector(`span[id="${option.issueId}LastPrice"]`);
  if (!el?.textContent) return null;
  const priceText = el.textContent.trim().replace(",", ".");
  const price = parseFloat(priceText);
  return isNaN(price) ? null : price;
}

function matchOption(holding: OptionHolding) {
  const pattern = /(CALL|PUT)\s+([\d.]+)\s+(\d{2})-(\d{2})-(\d{4})/i;
  const match = holding.product.match(pattern);
  if (!match) return null;
  const [, typeRaw, strikeRaw, day, month, year] = match;
  const strike = strikeRaw.replace(".", ",");
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
  const expiry = `${monthNames[parseInt(month) - 1]} ${year}`;
  const type = typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1).toLowerCase();
  return { strike, expiry, type };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { holdings } = await req.json();
    if (!Array.isArray(holdings) || holdings.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No holdings provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const scrapedOptions = await fetchOptionChain();
    const results: any[] = [];

    for (const holding of holdings) {
      const parsed = matchOption(holding);
      if (!parsed) {
        results.push({ product: holding.product, status: "failed", reason: "parse error" });
        continue;
      }

      const match = scrapedOptions.find(
        (opt) => opt.strike === parsed.strike && opt.expiry.includes(parsed.expiry) && opt.type === parsed.type,
      );

      if (!match) {
        results.push({ product: holding.product, status: "failed", reason: "no match found" });
        continue;
      }

      const price = await getLivePrice(match);
      if (price == null) {
        results.push({ product: holding.product, status: "failed", reason: "no price found" });
        continue;
      }
      results.push({ product: holding.product, status: "success", price });
      // throttle gently
      await new Promise((r) => setTimeout(r, 400));
    }

    // optional: Supabase update (unchanged from your code)
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
      await supabase.from("current_prices").upsert(
        {
          user_id: user.id,
          isin: holding.isin,
          current_price: u.price,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,isin" },
      );
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Function error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// file: supabase/functions/fetch-option-prices/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "https://api.koenmarijt.synology.me:444/api/latest";

interface OptionHolding {
  isin: string;
  product: string;
}

// Helper functions for option price fetching
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

// ---------- fetch price from API ----------
async function fetchPriceFromAPI(expiry: string, strike: string, type: string): Promise<number | null> {
  try {
    // Remove parentheses and extra info from expiry (e.g., "November 2025 (AEX / AH)" -> "November 2025")
    const cleanExpiry = expiry.replace(/\s*\(.*?\)\s*/g, "").trim();
    
    // Remove comma formatting from strike (e.g., "35,00" -> "35")
    const cleanStrike = Math.round(parseFloat(strike.replace(",", ".")));
    
    const url = `${API_BASE_URL}/${encodeURIComponent(cleanExpiry)}/${cleanStrike}/${type}`;
    console.log(`📞 Fetching from API: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`API returned ${response.status} for ${type} ${strike} ${cleanExpiry}`);
      return null;
    }
    
    const data = await response.json();
    const price = parseFloat(data.price);
    
    if (isNaN(price)) {
      console.warn(`Invalid price returned from API: ${data.price}`);
      return null;
    }
    
    console.log(`✅ Got price from API: ${price} (source: ${data.source})`);
    return price;
  } catch (err) {
    console.error(`Error fetching price from API:`, err);
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

    const results: any[] = [];

    for (const holding of holdings) {
      const parsed = matchOptionToHolding(holding);
      if (!parsed) {
        console.warn(`❌ Failed to parse: ${holding.product}`);
        results.push({ product: holding.product, status: "failed", reason: "parse error" });
        continue;
      }

      console.log(`✅ Parsed ${holding.product} → ${parsed.type} ${parsed.strike} ${parsed.expiry}`);

      const price = await fetchPriceFromAPI(parsed.expiry, parsed.strike, parsed.type);
      if (price == null) {
        results.push({ product: holding.product, status: "failed", reason: "no price found" });
        continue;
      }

      results.push({ product: holding.product, isin: holding.isin, status: "success", price });
      await new Promise((r) => setTimeout(r, 200));
    }

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get user from JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Invalid authorization token");
    }

    console.log(`Authenticated user: ${user.id}`);

    // Update database for successful fetches
    const successfulResults = results.filter(r => r.status === "success");
    
    for (const result of successfulResults) {
      // Update current_prices
      const { error: upsertError } = await supabase
        .from("current_prices")
        .upsert({
          user_id: user.id,
          isin: result.isin,
          current_price: result.price,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,isin"
        });
      
      if (upsertError) {
        console.error(`Error updating current_prices for ${result.isin}:`, upsertError);
      }

      // Insert into price_history
      const { error: historyError } = await supabase
        .from("price_history")
        .insert({
          user_id: user.id,
          isin: result.isin,
          product: result.product,
          price: result.price,
          timestamp: new Date().toISOString(),
        });
      
      if (historyError) {
        console.error(`Error inserting price_history for ${result.isin}:`, historyError);
      }
    }

    const successful = successfulResults.length;
    const failed = results.filter((r) => r.status === "failed").length;
    
    console.log(`✅ Finished fetching: ${successful}/${results.length} success`);

    return new Response(JSON.stringify({ 
      success: true, 
      summary: { successful, failed, total: results.length },
      results 
    }), {
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

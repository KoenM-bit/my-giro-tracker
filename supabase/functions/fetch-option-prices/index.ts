import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = "https://www.beursduivel.be";
const HEADERS = { "User-Agent": "Mozilla/5.0" };

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
  const cleaned = href.replace(/\.\.\/\.\.\//g, "/");
  return `${BASE_URL}${cleaned}`;
}

async function fetchOptionChain(): Promise<ScrapedOption[]> {
  const url = `${BASE_URL}/Aandeel-Koers/11755/Ahold-Delhaize-Koninklijke/opties-expiratiedatum.aspx`;
  
  console.log(`Fetching option chain from ${url}...`);
  
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch option chain: ${response.status}`);
  }
  
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("Failed to parse HTML");

  const options: ScrapedOption[] = [];
  const sections = doc.querySelectorAll("section.contentblock");

  for (const section of sections) {
    const sectionElement = section as Element;
    const expiryElement = sectionElement.querySelector("h3.titlecontent");
    const expiryText = expiryElement?.textContent?.trim() || "Unknown Expiry";

    const rows = sectionElement.querySelectorAll("tr");
    for (const row of rows) {
      const rowElement = row as Element;
      const strikeCellElement = rowElement.querySelector(".optiontable__focus");
      const strikeText = strikeCellElement?.textContent?.trim() || "";
      const strike = strikeText.split(/\s+/)[0] || null;

      if (!strike) continue;

      // Process both Call and Put
      for (const optType of ["Call", "Put"]) {
        const link = rowElement.querySelector(`a.optionlink.${optType}`);
        if (!link) continue;

        const href = link.getAttribute("href");
        if (!href) continue;

        // Extract issue_id from href
        const parts = href.split("/");
        const issueId = parts.find((p: string) => /^\d+$/.test(p));
        if (!issueId) continue;

        const fullUrl = cleanHref(href);
        options.push({
          type: optType,
          expiry: expiryText,
          strike,
          issueId,
          url: fullUrl,
        });
      }
    }
  }

  console.log(`Found ${options.length} options`);
  return options;
}

async function getLivePrice(issueId: string): Promise<number | null> {
  const detailUrl = `${BASE_URL}/Optie-Koers/${issueId}/dummy.aspx`;
  
  console.log(`Fetching live price for issue ${issueId}...`);
  
  const response = await fetch(detailUrl, { headers: HEADERS });
  if (!response.ok) {
    console.warn(`Failed to fetch price for ${issueId}: ${response.status}`);
    return null;
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  const priceElement = doc.querySelector(`span[id="${issueId}LastPrice"]`);
  if (!priceElement) {
    console.warn(`Price element not found for ${issueId}`);
    return null;
  }

  const priceText = priceElement.textContent?.trim();
  if (!priceText) return null;

  // Convert European decimal format (0,410 -> 0.410)
  const priceValue = parseFloat(priceText.replace(",", "."));
  
  console.log(`Found price for ${issueId}: ${priceValue}`);
  
  return isNaN(priceValue) ? null : priceValue;
}

function matchOptionToHolding(holding: OptionHolding): { strike: string; expiry: string; type: string } | null {
  const product = holding.product;

  // Match pattern like "AHOLD DELHAIZE CALL 38.00 17-11-2025"
  const optionPattern = /(CALL|PUT)\s+([\d.]+)\s+(\d{2})-(\d{2})-(\d{4})/i;
  const match = product.match(optionPattern);
  
  if (!match) {
    console.warn(`Could not parse option from product: ${product}`);
    return null;
  }

  const [, type, strikeStr, day, month, year] = match;
  const strike = strikeStr.replace(".", ","); // Convert to European format for matching
  
  // Convert date to month name format like "November 2025"
  const monthNames = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", 
                      "Juli", "Augustus", "September", "Oktober", "November", "December"];
  const monthIndex = parseInt(month) - 1;
  const expiry = `${monthNames[monthIndex]} ${year}`;

  return { strike, expiry, type: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { holdings } = await req.json();
    
    if (!Array.isArray(holdings) || holdings.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No holdings provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Fetching prices for ${holdings.length} options`);

    // Fetch the option chain once
    const scrapedOptions = await fetchOptionChain();

    const results = {
      successful: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const holding of holdings) {
      try {
        const parsedOption = matchOptionToHolding(holding);
        if (!parsedOption) {
          results.failed++;
          results.details.push({ 
            product: holding.product, 
            status: 'failed', 
            reason: 'Could not parse option details' 
          });
          continue;
        }

        // Find matching option in scraped data
        const matchedOption = scrapedOptions.find(opt => 
          opt.strike === parsedOption.strike &&
          opt.expiry === parsedOption.expiry &&
          opt.type === parsedOption.type
        );

        if (!matchedOption) {
          console.warn(`No matching option found for ${holding.product}`);
          results.failed++;
          results.details.push({ 
            product: holding.product, 
            status: 'failed', 
            reason: 'No matching option found on Beursduivel' 
          });
          continue;
        }

        // Fetch live price
        const price = await getLivePrice(matchedOption.issueId);
        
        if (price === null) {
          results.failed++;
          results.details.push({ 
            product: holding.product, 
            status: 'failed', 
            reason: 'Could not fetch live price' 
          });
          continue;
        }

        // Update or insert current price
        const { error: upsertError } = await supabase
          .from('current_prices')
          .upsert({
            user_id: user.id,
            isin: holding.isin,
            current_price: price,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,isin'
          });

        if (upsertError) {
          console.error(`Error updating price for ${holding.product}:`, upsertError);
          results.failed++;
          results.details.push({ 
            product: holding.product, 
            status: 'failed', 
            reason: 'Database update failed' 
          });
          continue;
        }

        results.successful++;
        results.details.push({ 
          product: holding.product, 
          status: 'success', 
          price 
        });

        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error processing ${holding.product}:`, error);
        results.failed++;
        results.details.push({ 
          product: holding.product, 
          status: 'failed', 
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`Successfully fetched ${results.successful}/${holdings.length} prices`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-option-prices function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

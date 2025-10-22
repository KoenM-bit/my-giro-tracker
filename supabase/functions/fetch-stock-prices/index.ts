import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0"; 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StockPrice {
  isin: string;
  product: string;
  price: number | null;
  error?: string;
}

// Extract ticker from product name
function extractTicker(product: string): string | null {
  // Common patterns in DeGiro product names:
  // "NVIDIA CORP" -> "NVDA"
  // "APPLE INC" -> "AAPL"
  // Usually the ticker is not in the product name, so we'll need ISIN lookup
  
  // For now, try to extract from common patterns
  const patterns = [
    /\(([A-Z]{1,5})\)/, // Ticker in parentheses
    /- ([A-Z]{1,5})$/, // Ticker after dash at end
  ];
  
  for (const pattern of patterns) {
    const match = product.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Get exchange suffix from ISIN country code
function getExchangeSuffix(isin: string): string {
  const countryCode = isin.substring(0, 2);
  
  const exchangeMap: Record<string, string> = {
    'NL': '.AS',  // Netherlands -> Amsterdam
    'FR': '.PA',  // France -> Paris
    'DE': '.DE',  // Germany -> XETRA
    'GB': '.L',   // UK -> London
    'IT': '.MI',  // Italy -> Milan
    'ES': '.MC',  // Spain -> Madrid
    'BE': '.BR',  // Belgium -> Brussels
    'CH': '.SW',  // Switzerland -> Swiss Exchange
    'SE': '.ST',  // Sweden -> Stockholm
    'DK': '.CO',  // Denmark -> Copenhagen
    'NO': '.OL',  // Norway -> Oslo
    'FI': '.HE',  // Finland -> Helsinki
    'US': '',     // US stocks don't need suffix
  };
  
  return exchangeMap[countryCode] || '';
}

// Convert ISIN to ticker using OpenFIGI API (free, no auth required)
async function isinToTicker(isin: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }])
    });
    
    if (!response.ok) {
      console.error(`OpenFIGI API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data[0]?.data?.[0]?.ticker) {
      const ticker = data[0].data[0].ticker;
      const suffix = getExchangeSuffix(isin);
      return ticker + suffix;
    }
  } catch (error) {
    console.error(`Error converting ISIN ${isin}:`, error);
  }
  
  return null;
}

// Fetch price from Yahoo Finance
async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    // Yahoo Finance API endpoint (using query2.finance.yahoo.com)
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (!response.ok) {
      console.error(`Yahoo Finance API error for ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    
    if (typeof price === 'number') {
      return price;
    }
  } catch (error) {
    console.error(`Error fetching price for ${ticker}:`, error);
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { holdings } = await req.json();
    
    if (!Array.isArray(holdings)) {
      throw new Error('Holdings must be an array');
    }

    console.log(`Fetching prices for ${holdings.length} holdings`);

    const results: StockPrice[] = [];
    
    // Process each holding
    for (const holding of holdings) {
      const { isin, product } = holding;
      
      // Skip options (they contain patterns like "CALL" or "PUT")
      if (product.includes('CALL') || product.includes('PUT')) {
        console.log(`Skipping option: ${product}`);
        results.push({
          isin,
          product,
          price: null,
          error: 'Options not supported'
        });
        continue;
      }
      
      // Try to get ticker from product name first
      let ticker = extractTicker(product);
      
      // If not found, convert ISIN to ticker
      if (!ticker) {
        console.log(`Converting ISIN ${isin} to ticker...`);
        ticker = await isinToTicker(isin);
      }
      
      if (!ticker) {
        console.log(`Could not find ticker for ${product} (${isin})`);
        results.push({
          isin,
          product,
          price: null,
          error: 'Ticker not found'
        });
        continue;
      }
      
      console.log(`Fetching price for ${ticker} (${product})...`);
      const price = await fetchYahooPrice(ticker);
      
      results.push({
        isin,
        product,
        price,
        error: price === null ? 'Price not available' : undefined
      });
      
      // Rate limiting - wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Update current_prices table for successful fetches
    const successfulPrices = results.filter(r => r.price !== null);
    
    for (const result of successfulPrices) {
      const { error: upsertError } = await supabase
        .from('current_prices')
        .upsert({
          user_id: user.id,
          isin: result.isin,
          current_price: result.price,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,isin'
        });
      
      if (upsertError) {
        console.error(`Error updating price for ${result.isin}:`, upsertError);
        result.error = 'Database update failed';
      }
    }

    console.log(`Successfully fetched ${successfulPrices.length}/${results.length} prices`);

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successfulPrices.length,
          failed: results.length - successfulPrices.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in fetch-stock-prices function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

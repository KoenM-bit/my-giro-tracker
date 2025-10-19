import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { PortfolioHolding } from '@/types/transaction';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';
import { ScenarioAnalysis } from './ScenarioAnalysis';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HoldingsTableProps {
  holdings: PortfolioHolding[];
  allHoldings?: PortfolioHolding[];
  excludedHoldings: Set<string>;
  onToggleExclusion: (key: string) => void;
  onPriceUpdate?: (isin: string, product: string, price: number) => void;
  onRefetchPrices?: () => Promise<void>;
}

export const HoldingsTable = ({ holdings, allHoldings, excludedHoldings, onToggleExclusion, onPriceUpdate, onRefetchPrices }: HoldingsTableProps) => {
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioStock, setScenarioStock] = useState<string>('');
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const handlePriceSubmit = (isin: string, product: string) => {
    const price = parseFloat(priceInput);
    if (!isNaN(price) && price > 0 && onPriceUpdate) {
      onPriceUpdate(isin, product, price);
    }
    setEditingPrice(null);
    setPriceInput('');
  };

  const calculateUnrealizedPL = (holding: PortfolioHolding) => {
    if (holding.currentPrice) {
      const basePL = (holding.currentPrice - holding.averagePrice) * holding.quantity;
      // Options have contract size of 100
      const isOption = /[CP]\d{2,}/.test(holding.product);
      return isOption ? basePL * 100 : basePL;
    }
    return null;
  };

  const isStock = (product: string) => {
    return !/[CP]\d{2,}/.test(product);
  };

  const hasOptionsForStock = (stockProduct: string) => {
    // Check if there are options that match this stock
    const holdingsToCheck = allHoldings || holdings;
    
    // Find options and extract their tickers
    return holdingsToCheck.some(h => {
      if (isStock(h.product)) return false;
      
      // Extract ticker from option (e.g., "AH C35.00 21NOV25" -> "AH")
      const match = h.product.match(/^([A-Z]+)\s+[CP]/i);
      if (!match) return false;
      
      const ticker = match[1];
      // Check if stock name includes this ticker
      return stockProduct.includes(ticker);
    });
  };

  const openScenarioAnalysis = (stockProduct: string) => {
    setScenarioStock(stockProduct);
    setScenarioOpen(true);
  };

  const handleFetchAllPrices = async () => {
    setIsFetchingPrices(true);
    
    try {
      const stockHoldings = holdings.filter(h => isStock(h.product));
      const optionHoldings = holdings.filter(h => !isStock(h.product));
      
      if (stockHoldings.length === 0 && optionHoldings.length === 0) {
        toast.info('No holdings to fetch prices for');
        setIsFetchingPrices(false);
        return;
      }

      const totalHoldings = stockHoldings.length + optionHoldings.length;
      toast.info(`Fetching prices for ${totalHoldings} holdings...`);

      let totalSuccessful = 0;
      let totalFailed = 0;

      // Fetch stock prices
      if (stockHoldings.length > 0) {
        const { data: stockData, error: stockError } = await supabase.functions.invoke('fetch-stock-prices', {
          body: {
            holdings: stockHoldings.map(h => ({
              isin: h.isin,
              product: h.product
            }))
          }
        });

        if (!stockError && stockData?.success) {
          totalSuccessful += stockData.summary.successful || 0;
          totalFailed += stockData.summary.failed || 0;
        }
      }

      // Fetch option prices
      if (optionHoldings.length > 0) {
        const { data: optionData, error: optionError } = await supabase.functions.invoke('fetch-option-prices', {
          body: {
            holdings: optionHoldings.map(h => ({
              isin: h.isin,
              product: h.product
            }))
          }
        });

        if (!optionError && optionData?.success) {
          totalSuccessful += optionData.summary.successful || 0;
          totalFailed += optionData.summary.failed || 0;
        }
      }

      // Reload prices from database
      if (onRefetchPrices) {
        await onRefetchPrices();
      }

      if (totalSuccessful > 0) {
        toast.success(`Updated ${totalSuccessful} of ${totalHoldings} prices successfully!`);
      } else {
        toast.warning('No prices could be fetched');
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error('Failed to fetch prices');
    } finally {
      setIsFetchingPrices(false);
    }
  };

  // Get holdings relevant to the scenario (stock + its options)
  const scenarioHoldings = scenarioStock 
    ? (allHoldings || holdings).filter(h => {
        // Include the stock itself
        if (h.product === scenarioStock) return true;
        
        // Include options that match this stock
        const match = h.product.match(/^([A-Z]+)\s+[CP]/i);
        if (!match) return false;
        
        const ticker = match[1];
        return scenarioStock.includes(ticker);
      })
    : [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Current Holdings</h3>
        <Badge variant="outline" className="text-xs">
          {holdings.length - excludedHoldings.size} active / {holdings.length} total
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Include</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>ISIN</TableHead>
              <TableHead className="w-16"></TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Avg. Price</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>Current Price</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFetchAllPrices}
                    disabled={isFetchingPrices}
                    className="h-6 w-6 p-0"
                    title="Refresh all prices"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetchingPrices ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </TableHead>
              <TableHead className="text-right">Unrealized P/L</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding, index) => {
              const key = `${holding.isin}-${holding.product}`;
              const isExcluded = excludedHoldings.has(key);
              return (
                <TableRow key={`${holding.isin}-${index}`} className={isExcluded ? 'opacity-50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={!isExcluded}
                      onCheckedChange={() => onToggleExclusion(key)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{holding.product}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{holding.isin}</TableCell>
                  <TableCell>
                    {isStock(holding.product) && hasOptionsForStock(holding.product) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openScenarioAnalysis(holding.product)}
                        title="Scenario Analysis"
                      >
                        <TrendingUp className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{holding.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(holding.averagePrice)}</TableCell>
                  <TableCell className="text-right">
                    {editingPrice === key ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        onBlur={() => handlePriceSubmit(holding.isin, holding.product)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePriceSubmit(holding.isin, holding.product);
                          if (e.key === 'Escape') { setEditingPrice(null); setPriceInput(''); }
                        }}
                        className="w-24 h-8"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        onClick={() => {
                          setEditingPrice(key);
                          setPriceInput(holding.currentPrice?.toString() || '');
                        }}
                      >
                        {holding.currentPrice ? formatCurrency(holding.currentPrice) : 'Set price'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const unrealizedPL = calculateUnrealizedPL(holding);
                      if (unrealizedPL !== null) {
                        const isProfit = unrealizedPL >= 0;
                        return (
                          <span className={isProfit ? 'text-success font-medium' : 'text-destructive font-medium'}>
                            {formatCurrency(unrealizedPL)}
                          </span>
                        );
                      }
                      return <span className="text-muted-foreground">-</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(holding.totalCost)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ScenarioAnalysis 
        holdings={scenarioHoldings}
        open={scenarioOpen}
        onOpenChange={setScenarioOpen}
      />
    </Card>
  );
};

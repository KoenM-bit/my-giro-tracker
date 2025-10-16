import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { parse } from 'date-fns';

interface Holding {
  product: string;
  isin: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  totalCost: number;
}

interface ScenarioAnalysisProps {
  holdings: Holding[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ScenarioAnalysis = ({ holdings, open, onOpenChange }: ScenarioAnalysisProps) => {
  const [selectedExpiration, setSelectedExpiration] = useState<string>('');
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  // Extract expiration dates from option holdings
  const expirationDates = useMemo(() => {
    const dates = new Set<string>();
    holdings.forEach(holding => {
      const match = holding.product.match(/(\d{2}[A-Z]{3}\d{2})/);
      if (match) {
        dates.add(match[1]);
      }
    });
    return Array.from(dates).sort((a, b) => {
      const dateA = parse(a, 'ddMMMyy', new Date());
      const dateB = parse(b, 'ddMMMyy', new Date());
      return dateA.getTime() - dateB.getTime();
    });
  }, [holdings]);

  // Get the underlying stock from options
  const underlyingStock = useMemo(() => {
    const optionHolding = holdings.find(h => h.product.match(/(\d{2}[A-Z]{3}\d{2})/));
    if (optionHolding) {
      // Extract stock symbol from option name (e.g., "AH C35.00 21NOV25" -> "AH")
      const match = optionHolding.product.match(/^([A-Z]+)\s+[CP]/i);
      return match ? match[1] : null;
    }
    return null;
  }, [holdings]);

  // Get current stock price
  const currentStockPrice = useMemo(() => {
    const stock = holdings.find(h => h.product.includes(underlyingStock || '') && !h.product.match(/(\d{2}[A-Z]{3}\d{2})/));
    return stock?.currentPrice || stock?.averagePrice || 0;
  }, [holdings, underlyingStock]);

  const calculateScenarioValue = (hypotheticalPrice: number) => {
    if (!selectedExpiration) return null;

    let optionsExpirationValue = 0;
    let optionsCurrentValue = 0;
    let stockValue = 0;
    let stockCurrentValue = 0;
    const optionDetails: Array<{ 
      product: string; 
      strike: number; 
      type: string; 
      quantity: number; 
      currentPrice: number;
      currentValue: number;
      expirationValue: number; 
      change: number;
    }> = [];
    const stockDetails: Array<{ 
      product: string; 
      quantity: number; 
      currentPrice: number; 
      newPrice: number; 
      currentValue: number; 
      newValue: number; 
      change: number;
    }> = [];

    holdings.forEach(holding => {
      const isOption = holding.product.match(/(\d{2}[A-Z]{3}\d{2})/);
      const holdingExpiration = isOption ? isOption[1] : null;

      if (holdingExpiration === selectedExpiration) {
        // This is an option expiring on the selected date
        // Match format: "AH C35.00 21NOV25" or "AH P35.00 21NOV25"
        const optionMatch = holding.product.match(/([A-Z]+)\s+([CP])([\d.]+)\s+\d{2}[A-Z]{3}\d{2}/i);
        if (optionMatch) {
          const optionType = optionMatch[2].toUpperCase() === 'C' ? 'CALL' : 'PUT';
          const strikePrice = parseFloat(optionMatch[3]);
          
          // Calculate intrinsic value PER SHARE at expiration
          let intrinsicValuePerShare = 0;
          if (optionType === 'CALL') {
            intrinsicValuePerShare = Math.max(hypotheticalPrice - strikePrice, 0);
          } else if (optionType === 'PUT') {
            intrinsicValuePerShare = Math.max(strikePrice - hypotheticalPrice, 0);
          }
          
          // Expiration value = intrinsic value * contracts * 100 shares per contract
          // For SHORT positions (negative quantity), this will be negative when ITM
          const expirationValue = intrinsicValuePerShare * holding.quantity * 100;

          // Current market value of the option position
          // For SHORT positions (negative quantity), this will be negative
          const currentPrice = holding.currentPrice || 0;
          const currentValue = currentPrice * holding.quantity * 100;
          
          // Change in option value from now to expiration
          // For short positions: if options expire worthless (expValue=0), and currentValue=-3640,
          // then change = 0 - (-3640) = +3640 (profit!)
          const change = expirationValue - currentValue;
          
          optionsExpirationValue += expirationValue;
          optionsCurrentValue += currentValue;
          
          optionDetails.push({
            product: holding.product,
            strike: strikePrice,
            type: optionType,
            quantity: holding.quantity,
            currentPrice: currentPrice,
            currentValue: currentValue,
            expirationValue: expirationValue,
            change: change,
          });
        }
      } else if (!isOption && holding.product.includes(underlyingStock || '')) {
        // This is the underlying stock
        const newValue = hypotheticalPrice * holding.quantity;
        const currentValue = (holding.currentPrice || holding.averagePrice) * holding.quantity;
        stockValue += newValue;
        stockCurrentValue += currentValue;
        stockDetails.push({
          product: holding.product,
          quantity: holding.quantity,
          currentPrice: holding.currentPrice || holding.averagePrice,
          newPrice: hypotheticalPrice,
          currentValue: currentValue,
          newValue: newValue,
          change: newValue - currentValue,
        });
      }
    });

    const optionsChange = optionsExpirationValue - optionsCurrentValue;
    const stockChange = stockValue - stockCurrentValue;
    const totalChange = optionsChange + stockChange;

    return {
      optionsCurrentValue,
      optionsExpirationValue,
      optionsChange,
      stockCurrentValue,
      stockValue,
      stockChange,
      totalChange,
      optionDetails,
      stockDetails,
    };
  };

  // Generate price scenarios around current price
  const priceScenarios = useMemo(() => {
    if (!currentStockPrice || !selectedExpiration) return [];
    
    const scenarios = [];
    const step = 0.5;
    const range = 10; // +/- 10 euros around current price
    
    for (let price = currentStockPrice - range; price <= currentStockPrice + range; price += step) {
      if (price > 0) {
        const result = calculateScenarioValue(price);
        if (result) {
          scenarios.push({
            price: Number(price.toFixed(2)),
            totalPL: result.totalChange,
            optionsPL: result.optionsChange,
            stockPL: result.stockChange,
          });
        }
      }
    }
    
    return scenarios;
  }, [currentStockPrice, selectedExpiration, holdings]);



  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  // Get selected scenario details
  const selectedScenario = useMemo(() => {
    if (!selectedPrice) return null;
    return calculateScenarioValue(selectedPrice);
  }, [selectedPrice]);

  if (expirationDates.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Scenario Analysis</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No option holdings found. This feature analyzes portfolio value at different price scenarios for option expiration dates.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Scenario Analysis - {underlyingStock} at {selectedExpiration || 'Select Date'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Expiration Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Expiration Date</label>
            <Select value={selectedExpiration} onValueChange={(val) => {
              setSelectedExpiration(val);
              setSelectedPrice(null);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select expiration date" />
              </SelectTrigger>
              <SelectContent>
                {expirationDates.map(date => (
                  <SelectItem key={date} value={date}>
                    {date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interactive Chart */}
          {selectedExpiration && priceScenarios.length > 0 && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={priceScenarios}
                      onClick={(e) => {
                        if (e && e.activePayload) {
                          setSelectedPrice(e.activePayload[0].payload.price);
                        }
                      }}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="price" 
                        label={{ value: `${underlyingStock} Price (€)`, position: 'insideBottom', offset: -5 }}
                        domain={['dataMin', 'dataMax']}
                      />
                      <YAxis 
                        label={{ value: 'P/L (€)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-background border rounded-lg p-3 shadow-lg">
                                <p className="font-semibold">Price: {formatCurrency(payload[0].payload.price)}</p>
                                <p className="text-sm text-green-600">Options P/L: {formatCurrency(payload[0].payload.optionsPL)}</p>
                                <p className="text-sm text-blue-600">Stock P/L: {formatCurrency(payload[0].payload.stockPL)}</p>
                                <p className="text-sm font-semibold">Total P/L: {formatCurrency(payload[0].payload.totalPL)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Click to see details</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <ReferenceLine 
                        x={currentStockPrice} 
                        stroke="hsl(var(--primary))" 
                        strokeDasharray="5 5"
                        label={{ value: 'Current', position: 'top' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalPL" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Click on the chart to see detailed breakdown at any price point
                  </p>
                </CardContent>
              </Card>

              {/* Selected Price Details */}
              {selectedPrice && selectedScenario && (
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Price: {formatCurrency(selectedPrice)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Impact on portfolio at expiration
                        </p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Options Change</p>
                        <p className={`text-xl font-bold ${selectedScenario.optionsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedScenario.optionsChange)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(selectedScenario.optionsCurrentValue)} → {formatCurrency(selectedScenario.optionsExpirationValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Stock Change</p>
                        <p className={`text-xl font-bold ${selectedScenario.stockChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedScenario.stockChange)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(selectedScenario.stockCurrentValue)} → {formatCurrency(selectedScenario.stockValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Net Change</p>
                        <p className={`text-xl font-bold ${selectedScenario.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedScenario.totalChange)}
                        </p>
                      </div>
                    </div>

                    {/* Options Details */}
                    {selectedScenario.optionDetails.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Options at Expiration</h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Strike</TableHead>
                                <TableHead className="text-right">Contracts</TableHead>
                                <TableHead className="text-right">Current Price</TableHead>
                                <TableHead className="text-right">Current Value</TableHead>
                                <TableHead className="text-right">Exp. Value</TableHead>
                                <TableHead className="text-right">Change</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedScenario.optionDetails.map((opt, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{opt.product}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(opt.strike)}</TableCell>
                                  <TableCell className="text-right">{opt.quantity}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(opt.currentPrice)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(opt.currentValue)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(opt.expirationValue)}</TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant={opt.change >= 0 ? 'default' : 'destructive'}>
                                      {formatCurrency(opt.change)}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Stock Details */}
                    {selectedScenario.stockDetails.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Stock Holdings</h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Current Price</TableHead>
                                <TableHead className="text-right">New Price</TableHead>
                                <TableHead className="text-right">Current Value</TableHead>
                                <TableHead className="text-right">New Value</TableHead>
                                <TableHead className="text-right">Change</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedScenario.stockDetails.map((stock, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{stock.product}</TableCell>
                                  <TableCell className="text-right">{stock.quantity}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(stock.currentPrice)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(stock.newPrice)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(stock.currentValue)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(stock.newValue)}</TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant={stock.change >= 0 ? 'default' : 'destructive'}>
                                      {formatCurrency(stock.change)}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

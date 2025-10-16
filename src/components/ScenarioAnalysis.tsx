import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { parse } from 'date-fns';

interface Holding {
  product: string;
  isin: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalCost: number;
}

interface ScenarioAnalysisProps {
  holdings: Holding[];
}

interface Scenario {
  id: string;
  price: number;
}

export const ScenarioAnalysis = ({ holdings }: ScenarioAnalysisProps) => {
  const [selectedExpiration, setSelectedExpiration] = useState<string>('');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [newScenarioPrice, setNewScenarioPrice] = useState<string>('');

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

  const addScenario = () => {
    const price = parseFloat(newScenarioPrice);
    if (!isNaN(price) && price > 0) {
      setScenarios([...scenarios, { id: Date.now().toString(), price }]);
      setNewScenarioPrice('');
    }
  };

  const removeScenario = (id: string) => {
    setScenarios(scenarios.filter(s => s.id !== id));
  };

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  if (expirationDates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Scenario Analysis
          </CardTitle>
          <CardDescription>
            No option holdings found. This feature analyzes portfolio value at different price scenarios for option expiration dates.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Scenario Analysis
        </CardTitle>
        <CardDescription>
          Analyze portfolio value at different stock prices on option expiration dates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Expiration Date</label>
            <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Add Price Scenario {underlyingStock && `(${underlyingStock})`}</label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                placeholder="Enter price"
                value={newScenarioPrice}
                onChange={(e) => setNewScenarioPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addScenario()}
              />
              <Button onClick={addScenario} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {selectedExpiration && scenarios.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Scenarios at {selectedExpiration}</h3>
            
            {scenarios.map(scenario => {
              const result = calculateScenarioValue(scenario.price);
              if (!result) return null;

              return (
                <Card key={scenario.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Stock Price: {formatCurrency(scenario.price)}</CardTitle>
                        <CardDescription>Impact on portfolio at expiration</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeScenario(scenario.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Options Change</p>
                        <p className={`text-xl font-bold ${result.optionsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(result.optionsChange)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(result.optionsCurrentValue)} → {formatCurrency(result.optionsExpirationValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Stock Change</p>
                        <p className={`text-xl font-bold ${result.stockChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(result.stockChange)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(result.stockCurrentValue)} → {formatCurrency(result.stockValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Net Change</p>
                        <p className={`text-xl font-bold ${result.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(result.totalChange)}
                        </p>
                      </div>
                    </div>

                    {/* Options Details */}
                    {result.optionDetails.length > 0 && (
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
                              {result.optionDetails.map((opt, idx) => (
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
                    {result.stockDetails.length > 0 && (
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
                              {result.stockDetails.map((stock, idx) => (
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

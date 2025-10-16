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
      // Extract stock symbol from option name (e.g., "CALL TSLA 21NOV25 350" -> "TSLA")
      const match = optionHolding.product.match(/(?:CALL|PUT)\s+([A-Z]+)/i);
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

    let totalValue = 0;
    let totalCost = 0;
    const details: Array<{ product: string; value: number; cost: number; pl: number }> = [];

    holdings.forEach(holding => {
      const isOption = holding.product.match(/(\d{2}[A-Z]{3}\d{2})/);
      const holdingExpiration = isOption ? isOption[1] : null;

      if (holdingExpiration === selectedExpiration) {
        // This is an option expiring on the selected date
        const optionMatch = holding.product.match(/(CALL|PUT)\s+[A-Z]+\s+\d{2}[A-Z]{3}\d{2}\s+([\d.]+)/i);
        if (optionMatch) {
          const optionType = optionMatch[1].toUpperCase();
          const strikePrice = parseFloat(optionMatch[2]);
          
          let optionValue = 0;
          if (optionType === 'CALL') {
            // Call option: max(stock price - strike, 0)
            optionValue = Math.max(hypotheticalPrice - strikePrice, 0) * holding.quantity * 100;
          } else if (optionType === 'PUT') {
            // Put option: max(strike - stock price, 0)
            optionValue = Math.max(strikePrice - hypotheticalPrice, 0) * holding.quantity * 100;
          }

          const cost = holding.totalCost;
          totalValue += optionValue;
          totalCost += cost;
          details.push({
            product: holding.product,
            value: optionValue,
            cost: cost,
            pl: optionValue + cost,
          });
        }
      } else if (!isOption && holding.product.includes(underlyingStock || '')) {
        // This is the underlying stock
        const stockValue = hypotheticalPrice * holding.quantity;
        const cost = holding.totalCost;
        totalValue += stockValue;
        totalCost += cost;
        details.push({
          product: holding.product,
          value: stockValue,
          cost: cost,
          pl: stockValue + cost,
        });
      }
    });

    return {
      totalValue,
      totalCost,
      totalPL: totalValue + totalCost,
      plPercentage: totalCost !== 0 ? ((totalValue + totalCost) / Math.abs(totalCost)) * 100 : 0,
      details,
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Scenarios at {selectedExpiration}</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stock Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">P/L</TableHead>
                    <TableHead className="text-right">P/L %</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenarios.map(scenario => {
                    const result = calculateScenarioValue(scenario.price);
                    if (!result) return null;

                    return (
                      <TableRow key={scenario.id}>
                        <TableCell className="font-medium">
                          {formatCurrency(scenario.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(result.totalValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(result.totalCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={result.totalPL >= 0 ? 'default' : 'destructive'}>
                            {formatCurrency(result.totalPL)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={result.totalPL >= 0 ? 'default' : 'destructive'}>
                            {result.plPercentage.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeScenario(scenario.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

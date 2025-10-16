import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { PortfolioHolding } from '@/types/transaction';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useState } from 'react';

interface HoldingsTableProps {
  holdings: PortfolioHolding[];
  excludedHoldings: Set<string>;
  onToggleExclusion: (key: string) => void;
  onPriceUpdate?: (isin: string, product: string, price: number) => void;
}

export const HoldingsTable = ({ holdings, excludedHoldings, onToggleExclusion, onPriceUpdate }: HoldingsTableProps) => {
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');

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
      return (holding.currentPrice - holding.averagePrice) * holding.quantity;
    }
    return null;
  };

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
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Avg. Price</TableHead>
              <TableHead className="text-right">Current Price</TableHead>
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
    </Card>
  );
};

import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { PortfolioHolding } from '@/types/transaction';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';

interface HoldingsTableProps {
  holdings: PortfolioHolding[];
  excludedHoldings: Set<string>;
  onToggleExclusion: (key: string) => void;
}

export const HoldingsTable = ({ holdings, excludedHoldings, onToggleExclusion }: HoldingsTableProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
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

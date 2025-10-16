import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { PortfolioHolding } from '@/types/transaction';

interface HoldingsTableProps {
  holdings: PortfolioHolding[];
}

export const HoldingsTable = ({ holdings }: HoldingsTableProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Current Holdings</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>ISIN</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Avg. Price</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding, index) => (
              <TableRow key={`${holding.isin}-${index}`}>
                <TableCell className="font-medium">{holding.product}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{holding.isin}</TableCell>
                <TableCell className="text-right">{holding.quantity}</TableCell>
                <TableCell className="text-right">{formatCurrency(holding.averagePrice)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(holding.totalCost)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

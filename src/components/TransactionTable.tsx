import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DeGiroTransaction } from '@/types/transaction';
import { Badge } from './ui/badge';

interface TransactionTableProps {
  transactions: DeGiroTransaction[];
}

export const TransactionTable = ({ transactions }: TransactionTableProps) => {
  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(value);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction, index) => {
              const isBuy = transaction.aantal > 0;
              return (
                <TableRow key={`${transaction.orderId}-${index}`}>
                  <TableCell className="text-sm">
                    {transaction.datum} {transaction.tijd}
                  </TableCell>
                  <TableCell className="font-medium">{transaction.product}</TableCell>
                  <TableCell>
                    <Badge variant={isBuy ? 'default' : 'secondary'}>
                      {isBuy ? 'BUY' : 'SELL'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{Math.abs(transaction.aantal)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(transaction.koers, transaction.koersCurrency)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${isBuy ? 'text-destructive' : 'text-success'}`}>
                    {formatCurrency(transaction.totaal, transaction.totaalCurrency)}
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

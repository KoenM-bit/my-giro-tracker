import { Card } from './ui/card';
import { TrendingUp, TrendingDown, Wallet, Receipt, LineChart } from 'lucide-react';

interface PortfolioOverviewProps {
  totalValue: number;
  totalCosts: number;
  optionsPL: number;
  stocksPL: number;
  totalPL: number;
  transactionCount: number;
}

export const PortfolioOverview = ({
  totalValue,
  totalCosts,
  optionsPL,
  stocksPL,
  totalPL,
  transactionCount,
}: PortfolioOverviewProps) => {
  const isOptionsProfitable = optionsPL >= 0;
  const isStocksProfitable = stocksPL >= 0;
  const isTotalProfitable = totalPL >= 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
            <h3 className="text-2xl font-bold mt-2">{formatCurrency(totalValue)}</h3>
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Options P/L</p>
            <h3 className={`text-2xl font-bold mt-2 ${isOptionsProfitable ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(optionsPL)}
            </h3>
          </div>
          <div className={`p-2 rounded-lg ${isOptionsProfitable ? 'bg-success/10' : 'bg-destructive/10'}`}>
            {isOptionsProfitable ? (
              <TrendingUp className="w-5 h-5 text-success" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive" />
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Stocks P/L</p>
            <h3 className={`text-2xl font-bold mt-2 ${isStocksProfitable ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(stocksPL)}
            </h3>
          </div>
          <div className={`p-2 rounded-lg ${isStocksProfitable ? 'bg-success/10' : 'bg-destructive/10'}`}>
            {isStocksProfitable ? (
              <TrendingUp className="w-5 h-5 text-success" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive" />
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total P/L</p>
            <h3 className={`text-2xl font-bold mt-2 ${isTotalProfitable ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totalPL)}
            </h3>
          </div>
          <div className={`p-2 rounded-lg ${isTotalProfitable ? 'bg-success/10' : 'bg-destructive/10'}`}>
            {isTotalProfitable ? (
              <TrendingUp className="w-5 h-5 text-success" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive" />
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Transaction Costs</p>
            <h3 className="text-2xl font-bold mt-2">{formatCurrency(totalCosts)}</h3>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10">
            <Receipt className="w-5 h-5 text-destructive" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
            <h3 className="text-2xl font-bold mt-2">{transactionCount}</h3>
          </div>
          <div className="p-2 rounded-lg bg-accent/10">
            <LineChart className="w-5 h-5 text-accent" />
          </div>
        </div>
      </Card>
    </div>
  );
};

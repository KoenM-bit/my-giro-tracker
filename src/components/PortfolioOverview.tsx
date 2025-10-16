import { Card } from './ui/card';
import { TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';

interface PortfolioOverviewProps {
  totalValue: number;
  totalCosts: number;
  profitLoss: number;
  transactionCount: number;
}

export const PortfolioOverview = ({
  totalValue,
  totalCosts,
  profitLoss,
  transactionCount,
}: PortfolioOverviewProps) => {
  const isProfit = profitLoss >= 0;
  const profitLossPercentage = totalValue !== 0 ? (profitLoss / Math.abs(totalValue)) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <p className="text-sm font-medium text-muted-foreground">Profit/Loss</p>
            <h3 className={`text-2xl font-bold mt-2 ${isProfit ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(profitLoss)}
            </h3>
            <p className={`text-sm mt-1 ${isProfit ? 'text-success' : 'text-destructive'}`}>
              {isProfit ? '+' : ''}{profitLossPercentage.toFixed(2)}%
            </p>
          </div>
          <div className={`p-2 rounded-lg ${isProfit ? 'bg-success/10' : 'bg-destructive/10'}`}>
            {isProfit ? (
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
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
        </div>
      </Card>
    </div>
  );
};

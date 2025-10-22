import { Card } from './ui/card';
import { TrendingUp, TrendingDown, Wallet, Receipt, LineChart, Lock, Unlock } from 'lucide-react';

// Portfolio overview component displaying key performance metrics
interface PortfolioOverviewProps {
  totalValue: number;
  totalCosts: number;
  optionsPL: number;
  stocksPL: number;
  totalPL: number;
  optionsRealized: number;
  optionsUnrealized: number;
  stocksRealized: number;
  stocksUnrealized: number;
  transactionCount: number;
  borrowedAmount: number;
}

export const PortfolioOverview = ({
  totalValue,
  totalCosts,
  optionsPL,
  stocksPL,
  totalPL,
  optionsRealized,
  optionsUnrealized,
  stocksRealized,
  stocksUnrealized,
  transactionCount,
  borrowedAmount,
}: PortfolioOverviewProps) => {
  const isOptionsProfitable = optionsPL >= 0;
  const isStocksProfitable = stocksPL >= 0;
  const isTotalProfitable = totalPL >= 0;
  const isOptionsRealizedProfitable = optionsRealized >= 0;
  const isOptionsUnrealizedProfitable = optionsUnrealized >= 0;
  const isStocksRealizedProfitable = stocksRealized >= 0;
  const isStocksUnrealizedProfitable = stocksUnrealized >= 0;

  const totalRealized = optionsRealized + stocksRealized;
  const totalUnrealized = optionsUnrealized + stocksUnrealized;
  const isTotalRealizedProfitable = totalRealized >= 0;
  const isTotalUnrealizedProfitable = totalUnrealized >= 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const netPortfolioValue = totalValue - borrowedAmount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div className="w-full">
              <p className="text-sm font-medium text-muted-foreground mb-2">Portfolio Value</p>
              <h3 className="text-2xl font-bold">{formatCurrency(totalValue)}</h3>
              {borrowedAmount > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Borrowed</span>
                    <span className="text-destructive">{formatCurrency(borrowedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Net Value</span>
                    <span>{formatCurrency(netPortfolioValue)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div className="w-full">
              <p className="text-sm font-medium text-muted-foreground mb-2">Options P/L</p>
              <h3 className={`text-2xl font-bold ${isOptionsProfitable ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(optionsPL)}
              </h3>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Realized
                  </span>
                  <span className={isOptionsRealizedProfitable ? 'text-success' : 'text-destructive'}>
                    {formatCurrency(optionsRealized)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Unlock className="w-3 h-3" />
                    Unrealized
                  </span>
                  <span className={isOptionsUnrealizedProfitable ? 'text-success' : 'text-destructive'}>
                    {formatCurrency(optionsUnrealized)}
                  </span>
                </div>
              </div>
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
            <div className="w-full">
              <p className="text-sm font-medium text-muted-foreground mb-2">Stocks P/L</p>
              <h3 className={`text-2xl font-bold ${isStocksProfitable ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(stocksPL)}
              </h3>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Realized
                  </span>
                  <span className={isStocksRealizedProfitable ? 'text-success' : 'text-destructive'}>
                    {formatCurrency(stocksRealized)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Unlock className="w-3 h-3" />
                    Unrealized
                  </span>
                  <span className={isStocksUnrealizedProfitable ? 'text-success' : 'text-destructive'}>
                    {formatCurrency(stocksUnrealized)}
                  </span>
                </div>
              </div>
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
            <div className="w-full">
              <p className="text-sm font-medium text-muted-foreground mb-2">Total P/L</p>
              <h3 className={`text-2xl font-bold ${isTotalProfitable ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(totalPL)}
              </h3>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Realized
                  </span>
                  <span className={isTotalRealizedProfitable ? 'text-success' : 'text-destructive'}>
                    {formatCurrency(totalRealized)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Unlock className="w-3 h-3" />
                    Unrealized
                  </span>
                  <span className={isTotalUnrealizedProfitable ? 'text-success' : 'text-destructive'}>
                    {formatCurrency(totalUnrealized)}
                  </span>
                </div>
              </div>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  );
};

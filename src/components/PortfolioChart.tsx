import { Card } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { PortfolioSnapshot, DeGiroTransaction, AccountActivity } from "@/types/transaction";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Button } from "./ui/button";
import { useState } from "react";
import { 
  calculateMonthlyReturns, 
  calculateYTDPerformance,
  calculateYearlyReturns
} from "@/utils/portfolioCalculations";

interface PortfolioChartProps {
  data: PortfolioSnapshot[];
  realizedData: PortfolioSnapshot[];
  timeframe: string;
  currentTotalPL?: number;
  transactions: DeGiroTransaction[];
  accountActivities: AccountActivity[];
  portfolioSize: number;
  borrowedAmount: number;
  totalValue: number;
}

export const PortfolioChart = ({ data, realizedData, timeframe, currentTotalPL, transactions, accountActivities, portfolioSize, borrowedAmount, totalValue }: PortfolioChartProps) => {
  const [realizedViewMode, setRealizedViewMode] = useState<'absolute' | 'percentage'>('absolute');
  const [realizedLineMode, setRealizedLineMode] = useState<'realized' | 'unrealized' | 'both'>('both');
  const [monthlyViewMode, setMonthlyViewMode] = useState<'absolute' | 'percentage'>('absolute');
  const [yearlyViewMode, setYearlyViewMode] = useState<'absolute' | 'percentage'>('absolute');
  const [ytdViewMode, setYtdViewMode] = useState<'absolute' | 'percentage'>('absolute');

  const netPortfolioValue = totalValue - borrowedAmount;

  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) {
      return "Invalid Date";
    }
    if (timeframe === "1D") return format(date, "HH:mm");
    if (timeframe === "1W" || timeframe === "1M") return format(date, "dd MMM");
    return format(date, "dd MMM yyyy");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Realized P/L chart data - uses realizedData
  const realizedChartData = realizedData
    .filter((snapshot) => snapshot.date && !isNaN(snapshot.date.getTime()))
    .map((snapshot) => ({
      date: formatDate(snapshot.date),
      dateKey: snapshot.date.getTime(),
      realized: snapshot.value,
      realizedPercentage: (snapshot.value / netPortfolioValue) * 100,
    }));

  // Create a map of total values by date
  const totalValueByDate = new Map(
    data
      .filter((snapshot) => snapshot.date && !isNaN(snapshot.date.getTime()))
      .map((snapshot) => [snapshot.date.getTime(), snapshot.value])
  );

  // Combine both datasets - unrealized = total - realized
  const combinedChartData = realizedChartData.map((item) => {
    const totalValue = totalValueByDate.get(item.dateKey) || 0;
    const unrealizedValue = totalValue - item.realized;
    return {
      date: item.date,
      realized: item.realized,
      realizedPercentage: item.realizedPercentage,
      unrealized: unrealizedValue,
      unrealizedPercentage: (unrealizedValue / netPortfolioValue) * 100,
    };
  });

  // YTD chart data
  const ytdData = calculateYTDPerformance(transactions, accountActivities)
    .filter((snapshot) => snapshot.date && !isNaN(snapshot.date.getTime()))
    .map((snapshot) => ({
      date: formatDate(snapshot.date),
      value: snapshot.value,
      percentage: (snapshot.value / netPortfolioValue) * 100,
    }));

  // Monthly returns data
  const monthlyData = calculateMonthlyReturns(transactions, accountActivities).map(item => ({
    ...item,
    percentage: (item.realized / netPortfolioValue) * 100,
  }));

  // Yearly returns data
  const yearlyData = calculateYearlyReturns(transactions, accountActivities).map(item => ({
    ...item,
    percentage: (item.realized / netPortfolioValue) * 100,
  }));

  // Cumulative returns data - removed as it's redundant with YTD percentage

  return (
    <Card className="p-6">
      <Tabs defaultValue="realized" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="realized">Realized P/L</TabsTrigger>
          <TabsTrigger value="ytd">YTD</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Returns</TabsTrigger>
          <TabsTrigger value="yearly">Yearly Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="realized">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Realized vs Unrealized P/L</h3>
            <div className="flex gap-2">
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={realizedLineMode === 'realized' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRealizedLineMode('realized')}
                >
                  Realized
                </Button>
                <Button
                  variant={realizedLineMode === 'unrealized' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRealizedLineMode('unrealized')}
                >
                  Unrealized
                </Button>
                <Button
                  variant={realizedLineMode === 'both' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRealizedLineMode('both')}
                >
                  Both
                </Button>
              </div>
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={realizedViewMode === 'absolute' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRealizedViewMode('absolute')}
                >
                  €
                </Button>
                <Button
                  variant={realizedViewMode === 'percentage' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRealizedViewMode('percentage')}
                >
                  %
                </Button>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={combinedChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis 
                className="text-xs" 
                tick={{ fill: "hsl(var(--muted-foreground))" }} 
                tickFormatter={realizedViewMode === 'absolute' ? formatCurrency : formatPercentage} 
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number, name: string) => {
                  if (realizedViewMode === 'absolute') {
                    if (name === 'realized') return [formatCurrency(value), "Realized"];
                    if (name === 'unrealized') return [formatCurrency(value), "Unrealized"];
                  } else {
                    if (name === 'realizedPercentage') return [formatPercentage(value), "Realized %"];
                    if (name === 'unrealizedPercentage') return [formatPercentage(value), "Unrealized %"];
                  }
                  return [value, name];
                }}
              />
              {(realizedLineMode === 'realized' || realizedLineMode === 'both') && (
                <Line 
                  type="monotone" 
                  dataKey={realizedViewMode === 'absolute' ? 'realized' : 'realizedPercentage'} 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  dot={false}
                  name={realizedViewMode === 'absolute' ? 'realized' : 'realizedPercentage'}
                />
              )}
              {(realizedLineMode === 'unrealized' || realizedLineMode === 'both') && (
                <Line 
                  type="monotone" 
                  dataKey={realizedViewMode === 'absolute' ? 'unrealized' : 'unrealizedPercentage'} 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={2} 
                  dot={false}
                  name={realizedViewMode === 'absolute' ? 'unrealized' : 'unrealizedPercentage'}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="ytd">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Year-to-Date Performance</h3>
            <div className="flex gap-2">
              <Button
                variant={ytdViewMode === 'absolute' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setYtdViewMode('absolute')}
              >
                € Absolute
              </Button>
              <Button
                variant={ytdViewMode === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setYtdViewMode('percentage')}
              >
                % Percentage
              </Button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ytdData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis 
                className="text-xs" 
                tick={{ fill: "hsl(var(--muted-foreground))" }} 
                tickFormatter={ytdViewMode === 'absolute' ? formatCurrency : formatPercentage} 
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'value' && ytdViewMode === 'absolute') return [formatCurrency(value), "Value"];
                  if (name === 'percentage' && ytdViewMode === 'percentage') return [formatPercentage(value), "Return %"];
                  return [value, name];
                }}
              />
              <Line 
                type="monotone" 
                dataKey={ytdViewMode === 'absolute' ? 'value' : 'percentage'} 
                stroke="hsl(var(--primary))" 
                strokeWidth={2} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Monthly Returns</h3>
            <div className="flex gap-2">
              <Button
                variant={monthlyViewMode === 'absolute' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMonthlyViewMode('absolute')}
              >
                € Absolute
              </Button>
              <Button
                variant={monthlyViewMode === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMonthlyViewMode('percentage')}
              >
                % Percentage
              </Button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis 
                className="text-xs" 
                tick={{ fill: "hsl(var(--muted-foreground))" }} 
                tickFormatter={monthlyViewMode === 'absolute' ? formatCurrency : formatPercentage} 
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'realized' && monthlyViewMode === 'absolute') return [formatCurrency(value), "Realized"];
                  if (name === 'percentage' && monthlyViewMode === 'percentage') return [formatPercentage(value), "Return %"];
                  return [value, name];
                }}
              />
              <Bar 
                dataKey={monthlyViewMode === 'absolute' ? 'realized' : 'percentage'} 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="yearly">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Yearly Returns</h3>
            <div className="flex gap-2">
              <Button
                variant={yearlyViewMode === 'absolute' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setYearlyViewMode('absolute')}
              >
                € Absolute
              </Button>
              <Button
                variant={yearlyViewMode === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setYearlyViewMode('percentage')}
              >
                % Percentage
              </Button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="year" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis 
                className="text-xs" 
                tick={{ fill: "hsl(var(--muted-foreground))" }} 
                tickFormatter={yearlyViewMode === 'absolute' ? formatCurrency : formatPercentage} 
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'realized' && yearlyViewMode === 'absolute') return [formatCurrency(value), "Realized"];
                  if (name === 'percentage' && yearlyViewMode === 'percentage') return [formatPercentage(value), "Return %"];
                  return [value, name];
                }}
              />
              <Bar 
                dataKey={yearlyViewMode === 'absolute' ? 'realized' : 'percentage'} 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

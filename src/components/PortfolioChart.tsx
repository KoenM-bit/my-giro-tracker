import { Card } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { PortfolioSnapshot, DeGiroTransaction, AccountActivity } from "@/types/transaction";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { 
  calculateMonthlyReturns, 
  calculateYTDPerformance, 
  calculateCumulativeReturns 
} from "@/utils/portfolioCalculations";

interface PortfolioChartProps {
  data: PortfolioSnapshot[];
  timeframe: string;
  currentTotalPL?: number;
  transactions: DeGiroTransaction[];
  accountActivities: AccountActivity[];
  portfolioSize: number;
}

export const PortfolioChart = ({ data, timeframe, currentTotalPL, transactions, accountActivities, portfolioSize }: PortfolioChartProps) => {
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

  // Realized P/L chart data
  const chartData = data
    .filter((snapshot) => snapshot.date && !isNaN(snapshot.date.getTime()))
    .map((snapshot, index, array) => {
      let value = snapshot.value;
      if (currentTotalPL !== undefined && index === array.length - 1) {
        value = currentTotalPL;
      }
      return {
        date: formatDate(snapshot.date),
        value,
      };
    });

  // YTD chart data
  const ytdData = calculateYTDPerformance(transactions, accountActivities)
    .filter((snapshot) => snapshot.date && !isNaN(snapshot.date.getTime()))
    .map((snapshot) => ({
      date: formatDate(snapshot.date),
      value: snapshot.value,
    }));

  // Monthly returns data
  const monthlyData = calculateMonthlyReturns(transactions, accountActivities);

  // Cumulative returns data
  const cumulativeData = calculateCumulativeReturns(transactions, accountActivities, portfolioSize)
    .filter((item) => item.date && !isNaN(item.date.getTime()))
    .map((item) => ({
      date: formatDate(item.date),
      percentage: item.percentage,
      value: item.value,
    }));

  return (
    <Card className="p-6">
      <Tabs defaultValue="realized" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="realized">Realized P/L</TabsTrigger>
          <TabsTrigger value="ytd">YTD</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Returns</TabsTrigger>
          <TabsTrigger value="cumulative">Cumulative %</TabsTrigger>
        </TabsList>

        <TabsContent value="realized">
          <h3 className="text-lg font-semibold mb-4">Realized Profit Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number) => [formatCurrency(value), "Value"]}
              />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="ytd">
          <h3 className="text-lg font-semibold mb-4">Year-to-Date Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ytdData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number) => [formatCurrency(value), "Value"]}
              />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="monthly">
          <h3 className="text-lg font-semibold mb-4">Monthly Returns</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number) => [formatCurrency(value), "Realized"]}
              />
              <Bar 
                dataKey="realized" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="cumulative">
          <h3 className="text-lg font-semibold mb-4">
            Portfolio Performance (Base: {formatCurrency(portfolioSize)})
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatPercentage} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "percentage") return [formatPercentage(value), "Return %"];
                  return [formatCurrency(value as number), "P/L"];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line type="monotone" dataKey="percentage" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

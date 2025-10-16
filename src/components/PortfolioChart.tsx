import { Card } from './ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PortfolioSnapshot } from '@/types/transaction';
import { format } from 'date-fns';

interface PortfolioChartProps {
  data: PortfolioSnapshot[];
  timeframe: string;
  currentTotalPL?: number;
}

export const PortfolioChart = ({ data, timeframe, currentTotalPL }: PortfolioChartProps) => {
  const formatDate = (date: Date) => {
    // Validate date before formatting
    if (!date || isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    if (timeframe === '1D') return format(date, 'HH:mm');
    if (timeframe === '1W' || timeframe === '1M') return format(date, 'dd MMM');
    return format(date, 'dd MMM yyyy');
  };

  const chartData = data
    .filter((snapshot) => snapshot.date && !isNaN(snapshot.date.getTime()))
    .map((snapshot, index, array) => {
      let value = snapshot.value;
      
      // For the last data point, adjust to show current Total P/L if provided
      if (currentTotalPL !== undefined && index === array.length - 1) {
        value = currentTotalPL;
      }
      
      return {
        date: formatDate(snapshot.date),
        value,
      };
    });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Portfolio Value Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis 
            dataKey="date" 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
            }}
            formatter={(value: number) => [formatCurrency(value), 'Value']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

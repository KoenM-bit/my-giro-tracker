import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Snapshot {
  timestamp: string;
  net_value: number;
  portfolio_value: number;
  borrowed_amount: number;
}

export const NetValueChart = () => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setSnapshots(data || []);
    } catch (error) {
      console.error('Error fetching snapshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy HH:mm');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Portfolio Value Over Time</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Portfolio Value Over Time</CardTitle>
          <CardDescription>No historical data available yet. Upload transactions or update prices to start tracking.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = snapshots.map(snapshot => ({
    date: formatDate(snapshot.timestamp),
    netValue: Number(snapshot.net_value),
    portfolioValue: Number(snapshot.portfolio_value),
    borrowedAmount: Number(snapshot.borrowed_amount),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Portfolio Value Over Time</CardTitle>
        <CardDescription>
          Tracking your portfolio value minus borrowed money ({snapshots.length} snapshots)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              className="text-xs"
              tickFormatter={formatCurrency}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Line
              type="monotone"
              dataKey="netValue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Net Value"
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="portfolioValue"
              stroke="hsl(var(--chart-2))"
              strokeWidth={1.5}
              name="Portfolio Value"
              dot={false}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

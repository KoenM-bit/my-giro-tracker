-- Create a table for portfolio value snapshots
CREATE TABLE public.portfolio_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  portfolio_value NUMERIC NOT NULL,
  borrowed_amount NUMERIC NOT NULL DEFAULT 0,
  net_value NUMERIC NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own snapshots" 
ON public.portfolio_snapshots 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own snapshots" 
ON public.portfolio_snapshots 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshots" 
ON public.portfolio_snapshots 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_portfolio_snapshots_user_timestamp ON public.portfolio_snapshots(user_id, timestamp DESC);
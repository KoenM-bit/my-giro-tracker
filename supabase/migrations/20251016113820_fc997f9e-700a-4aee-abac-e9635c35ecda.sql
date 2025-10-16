-- Create price_history table to track all price updates over time
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  isin TEXT NOT NULL,
  product TEXT NOT NULL,
  price NUMERIC NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own price history" 
ON public.price_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own price history" 
ON public.price_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own price history" 
ON public.price_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for efficient queries by user and time
CREATE INDEX idx_price_history_user_timestamp ON public.price_history(user_id, timestamp DESC);
CREATE INDEX idx_price_history_isin ON public.price_history(user_id, isin, timestamp DESC);
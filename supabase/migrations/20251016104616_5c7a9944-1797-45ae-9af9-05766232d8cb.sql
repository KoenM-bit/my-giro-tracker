-- Create current_prices table to store user-set current prices
CREATE TABLE public.current_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  isin TEXT NOT NULL,
  current_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, isin)
);

-- Enable Row Level Security
ALTER TABLE public.current_prices ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own current prices" 
ON public.current_prices 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own current prices" 
ON public.current_prices 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own current prices" 
ON public.current_prices 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own current prices" 
ON public.current_prices 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_current_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_current_prices_updated_at
BEFORE UPDATE ON public.current_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_current_prices_updated_at();

-- Create index for faster queries
CREATE INDEX idx_current_prices_user_isin ON public.current_prices(user_id, isin);
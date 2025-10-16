-- Create tables for storing transactions and account activities
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  datum TEXT NOT NULL,
  tijd TEXT NOT NULL,
  product TEXT NOT NULL,
  isin TEXT NOT NULL,
  beurs TEXT NOT NULL,
  uitvoeringsplaats TEXT NOT NULL,
  aantal NUMERIC NOT NULL,
  koers NUMERIC NOT NULL,
  koers_currency TEXT NOT NULL,
  lokale_waarde NUMERIC NOT NULL,
  lokale_waarde_currency TEXT NOT NULL,
  waarde NUMERIC NOT NULL,
  waarde_currency TEXT NOT NULL,
  wisselkoers NUMERIC NOT NULL,
  transactiekosten NUMERIC NOT NULL,
  transactiekosten_currency TEXT NOT NULL,
  totaal NUMERIC NOT NULL,
  totaal_currency TEXT NOT NULL,
  order_id TEXT NOT NULL,
  is_excluded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.account_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  datum TEXT NOT NULL,
  tijd TEXT NOT NULL,
  valutadatum TEXT NOT NULL,
  product TEXT NOT NULL,
  isin TEXT NOT NULL,
  omschrijving TEXT NOT NULL,
  fx TEXT NOT NULL,
  mutatie NUMERIC NOT NULL,
  mutatie_currency TEXT NOT NULL,
  saldo NUMERIC NOT NULL,
  saldo_currency TEXT NOT NULL,
  order_id TEXT NOT NULL,
  is_excluded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_activities ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions
CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" 
ON public.transactions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" 
ON public.transactions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for account activities
CREATE POLICY "Users can view their own account activities" 
ON public.account_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own account activities" 
ON public.account_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own account activities" 
ON public.account_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own account activities" 
ON public.account_activities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_account_activities_user_id ON public.account_activities(user_id);
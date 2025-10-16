-- Remove the overly strict unique constraint
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_unique_key;

ALTER TABLE public.account_activities 
DROP CONSTRAINT IF EXISTS account_activities_unique_key;

-- Add correct unique constraint for transactions
-- A transaction is unique by user_id, order_id, product, isin, aantal (quantity), and totaal (total)
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_unique_key 
UNIQUE (user_id, order_id, product, isin, aantal, totaal);

-- For account activities, keep the same constraint as it seems appropriate
-- (order_id + date + time should be sufficient for account activities)
ALTER TABLE public.account_activities 
ADD CONSTRAINT account_activities_unique_key 
UNIQUE (user_id, order_id, datum, tijd);
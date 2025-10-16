-- Remove the current constraint that's too loose
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_unique_key;

-- Add a more comprehensive unique constraint that uses more fields
-- This creates a precise "fingerprint" of each transaction
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_unique_key 
UNIQUE (user_id, datum, tijd, product, isin, aantal, koers, waarde, totaal, transactiekosten);
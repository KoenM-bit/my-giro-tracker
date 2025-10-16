-- Remove the unique constraint entirely
-- We'll handle duplicate detection in application logic instead
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_unique_key;
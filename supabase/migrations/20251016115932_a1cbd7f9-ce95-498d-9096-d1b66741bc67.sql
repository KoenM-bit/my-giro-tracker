-- Remove the unique constraint for account activities too
ALTER TABLE public.account_activities 
DROP CONSTRAINT IF EXISTS account_activities_unique_key;
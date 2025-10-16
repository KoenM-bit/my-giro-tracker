-- Remove duplicate transactions, keeping only the oldest entry for each unique combination
DELETE FROM public.transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, order_id, datum, tijd 
             ORDER BY created_at ASC
           ) AS rn
    FROM public.transactions
  ) t
  WHERE t.rn > 1
);

-- Remove duplicate account activities, keeping only the oldest entry for each unique combination
DELETE FROM public.account_activities
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, order_id, datum, tijd 
             ORDER BY created_at ASC
           ) AS rn
    FROM public.account_activities
  ) t
  WHERE t.rn > 1
);

-- Now add unique constraints to prevent future duplicates
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_unique_key 
UNIQUE (user_id, order_id, datum, tijd);

ALTER TABLE public.account_activities 
ADD CONSTRAINT account_activities_unique_key 
UNIQUE (user_id, order_id, datum, tijd);
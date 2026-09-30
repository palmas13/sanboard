BEGIN;

ALTER TABLE public.listings
  ALTER COLUMN description TYPE VARCHAR(200)
  USING left(description, 200);

COMMIT;
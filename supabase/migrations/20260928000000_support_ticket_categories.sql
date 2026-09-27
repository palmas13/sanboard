BEGIN;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_category_check
  CHECK (
    category IS NULL OR category IN (
      'LISTING',
      'PAYMENT',
      'CORPORATE',
      'ACCOUNT_CHARACTER',
      'REPORT_MODERATION',
      'OTHER'
    )
  ) NOT VALID;

ALTER TABLE public.support_tickets
  VALIDATE CONSTRAINT support_tickets_category_check;

COMMIT;
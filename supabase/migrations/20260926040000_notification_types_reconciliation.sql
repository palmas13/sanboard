-- Reconcile notifications.type with the canonical application notification types.
-- This migration is intentionally limited to the CHECK constraint.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'LISTING_PRICE_DROP',
    'LISTING_PRICE_CHANGE',
    'SUPPORT_REPLY',
    'SYSTEM',
    'LISTING_EXPIRES_SOON',
    'CORPORATE_APPLICATION_APPROVED',
    'CORPORATE_APPLICATION_REJECTED',
    'NEW_CORPORATE_LISTING',
    'NEW_FOLLOWER',
    'CORPORATE_SUBSCRIPTION_EXPIRING',
    'CORPORATE_STORE_SUSPENDED',
    'CORPORATE_STORE_REACTIVATED',
    'CORPORATE_STORE_DELETED'
  )) NOT VALID;

ALTER TABLE public.notifications
  VALIDATE CONSTRAINT notifications_type_check;
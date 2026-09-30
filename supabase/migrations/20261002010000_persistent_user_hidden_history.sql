BEGIN;

ALTER TABLE public.offer_threads
  ADD COLUMN IF NOT EXISTS buyer_hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_hidden_at TIMESTAMPTZ;

ALTER TABLE public.character_profiles
  ADD COLUMN IF NOT EXISTS payment_history_cleared_at TIMESTAMPTZ;

-- A user's explicit removal is durable. Offer events remain as audit/history
-- records, but a later counterparty or system event must not restore the row.
DROP TRIGGER IF EXISTS offer_event_restores_participant_visibility ON public.offer_events;
DROP FUNCTION IF EXISTS public.restore_offer_thread_visibility_on_event();

COMMENT ON COLUMN public.offer_threads.buyer_hidden_at IS
  'Durable buyer-scoped visibility cutoff. Hidden threads remain hidden after new events and redeploys.';
COMMENT ON COLUMN public.offer_threads.seller_hidden_at IS
  'Durable seller-scoped visibility cutoff. Hidden threads remain hidden after new events and redeploys.';
COMMENT ON COLUMN public.character_profiles.payment_history_cleared_at IS
  'Durable profile-scoped payment history cutoff. Payment and entitlement audit rows remain intact.';

COMMIT;
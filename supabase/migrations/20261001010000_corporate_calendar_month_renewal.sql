-- Corporate subscriptions are sold as one calendar month. Replace the legacy
-- fixed 30-day interval inside the canonical, row-locked/idempotent completion
-- RPC without creating a second payment integration or bypassing Fleeca.
BEGIN;

DO $$
DECLARE
  v_definition TEXT;
  v_rewritten TEXT;
BEGIN
  SELECT pg_get_functiondef('public.complete_sanboard_payment(text,text)'::regprocedure)
  INTO v_definition;

  -- pg_get_functiondef normalizes INTERVAL literals to casts. Support both
  -- representations so this remains safe across supported PostgreSQL versions.
  v_rewritten := replace(v_definition, '''30 days''::interval', '''1 month''::interval');
  v_rewritten := replace(v_rewritten, 'INTERVAL ''30 days''', 'INTERVAL ''1 month''');

  IF v_rewritten = v_definition THEN
    IF position('1 month' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'complete_sanboard_payment has an unexpected subscription interval';
    END IF;
  ELSE
    EXECUTE v_rewritten;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) TO service_role;

COMMIT;
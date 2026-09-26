-- Dynamic identity foundation lookup index.
-- Review and apply manually; this migration is not executed by this task.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_character_profiles_user_id
ON public.character_profiles(user_id);

COMMIT;
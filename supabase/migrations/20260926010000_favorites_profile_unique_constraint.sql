-- Favorites are character-scoped. A real UNIQUE constraint (not a partial
-- index) is required so PostgREST can use ON CONFLICT(profile_id, listing_id).

DELETE FROM public.favorites a
USING public.favorites b
WHERE a.id < b.id
  AND a.profile_id IS NOT NULL
  AND a.profile_id = b.profile_id
  AND a.listing_id = b.listing_id;

DROP INDEX IF EXISTS public.uq_favorites_profile_listing;

ALTER TABLE public.favorites
DROP CONSTRAINT IF EXISTS favorites_profile_id_listing_id_key;

ALTER TABLE public.favorites
ADD CONSTRAINT favorites_profile_id_listing_id_key
UNIQUE (profile_id, listing_id);
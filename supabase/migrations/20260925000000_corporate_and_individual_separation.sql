-- ============================================================================
-- SANBOARD MIGRATION: Bireysel ve Kurumsal Profil / İlan Ayrımı, Takipçi ve Boost
-- File: 20260925000000_corporate_and_individual_separation.sql
-- ============================================================================

-- 1. SANMAIL VE TELEFON BENZERSİZLİĞİ (Section 26)
-- Karakterlerin SanMail (case-insensitive) ve telefon numaraları benzersiz olmalıdır.
CREATE UNIQUE INDEX IF NOT EXISTS idx_character_profiles_sanmail_lower 
ON public.character_profiles (LOWER(sanmail_email)) 
WHERE sanmail_email IS NOT NULL AND sanmail_email != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_character_profiles_phone 
ON public.character_profiles (phone) 
WHERE phone IS NOT NULL AND phone != '';

-- 2. KURUMSAL BAŞVURULAR RED NEDENİ (Section 7)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'corporate_applications' 
          AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.corporate_applications ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- 3. KURUMSAL ABONELİK VE ÖNE ÇIKARMA HAKLARI (Section 8, 9, 10, 13, 19, 20)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'corporate_profiles' 
          AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE public.corporate_profiles 
        ADD COLUMN subscription_status TEXT DEFAULT 'ACTIVE' 
        CHECK (subscription_status IN ('INACTIVE', 'ACTIVE', 'EXPIRED'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'corporate_profiles' 
          AND column_name = 'subscription_expires_at'
    ) THEN
        ALTER TABLE public.corporate_profiles 
        ADD COLUMN subscription_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'corporate_profiles' 
          AND column_name = 'boost_credits'
    ) THEN
        ALTER TABLE public.corporate_profiles 
        ADD COLUMN boost_credits INTEGER NOT NULL DEFAULT 3;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'corporate_profiles' 
          AND column_name = 'social_media'
    ) THEN
        ALTER TABLE public.corporate_profiles 
        ADD COLUMN social_media JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 4. İLAN ÖNE ÇIKARMA ALANLARI (Section 13)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'listings' 
          AND column_name = 'is_featured'
    ) THEN
        ALTER TABLE public.listings 
        ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'listings' 
          AND column_name = 'featured_until'
    ) THEN
        ALTER TABLE public.listings 
        ADD COLUMN featured_until TIMESTAMPTZ;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_featured 
ON public.listings (is_featured, featured_until) 
WHERE is_featured = TRUE;

-- 5. KURUMSAL MAĞAZA TAKİPÇİ SİSTEMİ (Section 16, 17, 18)
CREATE TABLE IF NOT EXISTS public.corporate_followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_profile_id UUID NOT NULL REFERENCES public.character_profiles(id) ON DELETE CASCADE,
    corporate_profile_id UUID NOT NULL REFERENCES public.corporate_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT corporate_followers_unique UNIQUE (follower_profile_id, corporate_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_corporate_followers_corp ON public.corporate_followers (corporate_profile_id);
CREATE INDEX IF NOT EXISTS idx_corporate_followers_profile ON public.corporate_followers (follower_profile_id);

-- RLS Güvenlik Politikaları
ALTER TABLE public.corporate_followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view corporate followers" ON public.corporate_followers;
CREATE POLICY "Public can view corporate followers" 
ON public.corporate_followers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Characters can follow and unfollow corporate stores" ON public.corporate_followers;
CREATE POLICY "Characters can follow and unfollow corporate stores" 
ON public.corporate_followers FOR ALL USING (true);

-- ==============================================================================
-- Migration: 20260924050000_gtaworld_oauth_and_audit.sql
-- Description:
-- 1. Adds unique index on users(provider, external_user_id) for idempotent OAuth sync.
-- 2. Adds unique index on character_profiles(external_character_id).
-- 3. Creates audit_logs table for GTA World compliance & security events.
-- ==============================================================================

-- 1. UNIQUE INDEX ON (provider, external_user_id)
-- Ensures an external GTA World user ID is mapped to at most one Sanboard user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_external_id 
ON public.users(provider, external_user_id) 
WHERE external_user_id IS NOT NULL;

-- 2. UNIQUE INDEX ON character_profiles(external_character_id)
-- Ensures an external GTA World character ID is mapped to at most one character profile.
CREATE UNIQUE INDEX IF NOT EXISTS idx_character_profiles_external_char_id 
ON public.character_profiles(external_character_id) 
WHERE external_character_id IS NOT NULL;

-- 3. AUDIT LOGS TABLE FOR REGULATORY & SECURITY COMPLIANCE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES public.character_profiles(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying audit events chronologically by type
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type_created_at 
ON public.audit_logs(event_type, created_at DESC);

-- Index for looking up audit logs by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
ON public.audit_logs(user_id);

-- Enable Row Level Security (RLS) on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access to audit_logs
DROP POLICY IF EXISTS "Service role can manage audit logs" ON public.audit_logs;
CREATE POLICY "Service role can manage audit logs" ON public.audit_logs
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow admins to read audit logs
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs
    FOR SELECT
    USING (public.is_admin());

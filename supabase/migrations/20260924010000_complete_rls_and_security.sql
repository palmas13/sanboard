-- Sanboard Database Comprehensive RLS Policies & Security Hardening
-- Migration: 20260924010000_complete_rls_and_security.sql

-- ============================================================================
-- 1. HELPER SECURITY FUNCTIONS
-- ============================================================================

-- Check if current authenticated user has ADMIN role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'ADMIN'
      AND status = 'ACTIVE'
  );
$$;

-- Get the character profile IDs owned by current authenticated user
CREATE OR REPLACE FUNCTION public.get_auth_profile_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.character_profiles
  WHERE user_id = auth.uid();
$$;

-- ============================================================================
-- 2. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sold_listing_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. USERS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own record" ON public.users;
CREATE POLICY "Users can read own record" ON public.users
    FOR SELECT
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own record" ON public.users;
CREATE POLICY "Users can update own record" ON public.users
    FOR UPDATE
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;
CREATE POLICY "Service role can manage all users" ON public.users
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 4. CHARACTER PROFILES POLICIES
-- ============================================================================

-- Public can view basic character profile info (seller name, avatar)
DROP POLICY IF EXISTS "Public can view character profiles" ON public.character_profiles;
CREATE POLICY "Public can view character profiles" ON public.character_profiles
    FOR SELECT
    USING (true);

-- User can update only their own character profiles
DROP POLICY IF EXISTS "Users can update own character profiles" ON public.character_profiles;
CREATE POLICY "Users can update own character profiles" ON public.character_profiles
    FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Users can insert their own character profile
DROP POLICY IF EXISTS "Users can insert own character profiles" ON public.character_profiles;
CREATE POLICY "Users can insert own character profiles" ON public.character_profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 5. CORPORATE PROFILES & APPLICATIONS POLICIES
-- ============================================================================

-- Anyone can view approved corporate profiles
DROP POLICY IF EXISTS "Public can view approved corporate profiles" ON public.corporate_profiles;
CREATE POLICY "Public can view approved corporate profiles" ON public.corporate_profiles
    FOR SELECT
    USING (status = 'APPROVED' OR owner_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin());

-- Corporate profile owner can update their store details
DROP POLICY IF EXISTS "Owners can update corporate profiles" ON public.corporate_profiles;
CREATE POLICY "Owners can update corporate profiles" ON public.corporate_profiles
    FOR UPDATE
    USING (owner_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin())
    WITH CHECK (owner_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin());

-- Corporate applications: Applicant and admins can view
DROP POLICY IF EXISTS "Applicants and admins can view corporate applications" ON public.corporate_applications;
CREATE POLICY "Applicants and admins can view corporate applications" ON public.corporate_applications
    FOR SELECT
    USING (applicant_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin());

-- Applicants can submit application
DROP POLICY IF EXISTS "Users can submit corporate applications" ON public.corporate_applications;
CREATE POLICY "Users can submit corporate applications" ON public.corporate_applications
    FOR INSERT
    WITH CHECK (applicant_profile_id IN (SELECT public.get_auth_profile_ids()));

-- Admins can update/review corporate applications
DROP POLICY IF EXISTS "Admins can update corporate applications" ON public.corporate_applications;
CREATE POLICY "Admins can update corporate applications" ON public.corporate_applications
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- 6. PACKAGES, PAYMENTS & CREDITS POLICIES
-- ============================================================================

-- Anyone can view active packages
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.packages;
CREATE POLICY "Anyone can view active packages" ON public.packages
    FOR SELECT
    USING (active = TRUE OR public.is_admin());

-- Admins can manage packages
DROP POLICY IF EXISTS "Admins can manage packages" ON public.packages;
CREATE POLICY "Admins can manage packages" ON public.packages
    FOR ALL
    USING (public.is_admin());

-- Payments: Profile owner can view their own payments
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT
    USING (profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin());

-- Listing Credits: Profile owner can view their own credits
DROP POLICY IF EXISTS "Users can view own credits" ON public.listing_credits;
CREATE POLICY "Users can view own credits" ON public.listing_credits
    FOR SELECT
    USING (profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin());

-- ============================================================================
-- 7. LISTINGS POLICIES
-- ============================================================================

-- Public can view ACTIVE and unexpired listings
-- Owners can view all their listings (DRAFT, EXPIRED, SOLD, REMOVED)
-- Admins can view all listings
DROP POLICY IF EXISTS "Listings select policy" ON public.listings;
CREATE POLICY "Listings select policy" ON public.listings
    FOR SELECT
    USING (
        (status = 'ACTIVE' AND expires_at > NOW())
        OR (seller_profile_id IN (SELECT public.get_auth_profile_ids()))
        OR public.is_admin()
    );

-- Owners can insert listings for their own profile
DROP POLICY IF EXISTS "Users can insert listings" ON public.listings;
CREATE POLICY "Users can insert listings" ON public.listings
    FOR INSERT
    WITH CHECK (
        seller_profile_id IN (SELECT public.get_auth_profile_ids())
        OR public.is_admin()
    );

-- Owners can update their own listings (cannot edit if SOLD or REMOVED unless admin)
DROP POLICY IF EXISTS "Users can update own listings" ON public.listings;
CREATE POLICY "Users can update own listings" ON public.listings
    FOR UPDATE
    USING (
        (seller_profile_id IN (SELECT public.get_auth_profile_ids()) AND status NOT IN ('SOLD', 'REMOVED'))
        OR public.is_admin()
    )
    WITH CHECK (
        (seller_profile_id IN (SELECT public.get_auth_profile_ids()))
        OR public.is_admin()
    );

-- Owners and admins can delete draft listings
DROP POLICY IF EXISTS "Users can delete own draft listings" ON public.listings;
CREATE POLICY "Users can delete own draft listings" ON public.listings
    FOR DELETE
    USING (
        (seller_profile_id IN (SELECT public.get_auth_profile_ids()) AND status = 'DRAFT')
        OR public.is_admin()
    );

-- ============================================================================
-- 8. VEHICLE DETAILS, PROPERTY DETAILS & IMAGES
-- ============================================================================

-- Vehicle Details
DROP POLICY IF EXISTS "Vehicle details select" ON public.vehicle_details;
CREATE POLICY "Vehicle details select" ON public.vehicle_details
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = vehicle_details.listing_id
              AND (
                (l.status = 'ACTIVE' AND l.expires_at > NOW())
                OR l.seller_profile_id IN (SELECT public.get_auth_profile_ids())
                OR public.is_admin()
              )
        )
    );

DROP POLICY IF EXISTS "Vehicle details insert/update" ON public.vehicle_details;
CREATE POLICY "Vehicle details insert/update" ON public.vehicle_details
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = vehicle_details.listing_id
              AND (l.seller_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin())
        )
    );

-- Property Details
DROP POLICY IF EXISTS "Property details select" ON public.property_details;
CREATE POLICY "Property details select" ON public.property_details
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = property_details.listing_id
              AND (
                (l.status = 'ACTIVE' AND l.expires_at > NOW())
                OR l.seller_profile_id IN (SELECT public.get_auth_profile_ids())
                OR public.is_admin()
              )
        )
    );

DROP POLICY IF EXISTS "Property details insert/update" ON public.property_details;
CREATE POLICY "Property details insert/update" ON public.property_details
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = property_details.listing_id
              AND (l.seller_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin())
        )
    );

-- Listing Images
DROP POLICY IF EXISTS "Listing images select" ON public.listing_images;
CREATE POLICY "Listing images select" ON public.listing_images
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = listing_images.listing_id
              AND (
                (l.status = 'ACTIVE' AND l.expires_at > NOW())
                OR l.seller_profile_id IN (SELECT public.get_auth_profile_ids())
                OR public.is_admin()
              )
        )
    );

DROP POLICY IF EXISTS "Listing images manage" ON public.listing_images;
CREATE POLICY "Listing images manage" ON public.listing_images
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = listing_images.listing_id
              AND (l.seller_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin())
        )
    );

-- ============================================================================
-- 9. FAVORITES POLICIES (Account-Level Protection)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites" ON public.favorites
    FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites" ON public.favorites
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites
    FOR DELETE
    USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 10. NOTIFICATIONS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE
    USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 11. PRICE HISTORY POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view listing price history" ON public.listing_price_history;
CREATE POLICY "Anyone can view listing price history" ON public.listing_price_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.listings l
            WHERE l.id = listing_price_history.listing_id
              AND (
                (l.status = 'ACTIVE' AND l.expires_at > NOW())
                OR l.seller_profile_id IN (SELECT public.get_auth_profile_ids())
                OR public.is_admin()
              )
        )
    );

-- ============================================================================
-- 12. SUPPORT TICKETS & MESSAGES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
CREATE POLICY "Users can view own tickets" ON public.support_tickets
    FOR SELECT
    USING (profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert tickets" ON public.support_tickets;
CREATE POLICY "Users can insert tickets" ON public.support_tickets
    FOR INSERT
    WITH CHECK (profile_id IN (SELECT public.get_auth_profile_ids()));

DROP POLICY IF EXISTS "Users can view messages of their tickets" ON public.ticket_messages;
CREATE POLICY "Users can view messages of their tickets" ON public.ticket_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_messages.ticket_id
              AND (t.profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "Users and admins can insert messages" ON public.ticket_messages;
CREATE POLICY "Users and admins can insert messages" ON public.ticket_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_messages.ticket_id
              AND (t.profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin())
        )
    );

-- ============================================================================
-- 13. REPORTS & AUDIT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can submit reports" ON public.reports;
CREATE POLICY "Users can submit reports" ON public.reports
    FOR INSERT
    WITH CHECK (reporter_profile_id IN (SELECT public.get_auth_profile_ids()));

DROP POLICY IF EXISTS "Users can view own reports, Admins can view all" ON public.reports;
CREATE POLICY "Users can view own reports, Admins can view all" ON public.reports
    FOR SELECT
    USING (reporter_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports" ON public.reports
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins and sellers can view sold audits" ON public.sold_listing_audit;
CREATE POLICY "Admins and sellers can view sold audits" ON public.sold_listing_audit
    FOR SELECT
    USING (seller_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin());

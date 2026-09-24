-- Sanboard Database Initial Migration
-- PostgreSQL / Supabase Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL DEFAULT 'GTAWORLD',
    external_user_id TEXT,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BANNED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CHARACTER PROFILES
CREATE TABLE IF NOT EXISTS character_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_character_id TEXT,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    sanmail_email TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_dealer BOOLEAN NOT NULL DEFAULT FALSE,
    dealer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CORPORATE PROFILES (Galeriler & Kurumsal Mağazalar)
CREATE TABLE IF NOT EXISTS corporate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_profile_id UUID NOT NULL REFERENCES character_profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_premium BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CORPORATE APPLICATIONS (Kurumsal Başvurular)
CREATE TABLE IF NOT EXISTS corporate_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    applicant_profile_id UUID NOT NULL REFERENCES character_profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PACKAGES
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 2000,
    duration_days INTEGER NOT NULL DEFAULT 7,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id TEXT UNIQUE NOT NULL,
    profile_id UUID NOT NULL REFERENCES character_profiles(id),
    package_id UUID NOT NULL REFERENCES packages(id),
    provider TEXT NOT NULL DEFAULT 'FLEECA',
    external_payment_id TEXT,
    amount INTEGER NOT NULL DEFAULT 2000,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- 7. LISTING CREDITS (1 Payment = 1 Listing Credit = 1 Published Listing)
CREATE TABLE IF NOT EXISTS listing_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES character_profiles(id),
    payment_id UUID NOT NULL REFERENCES payments(id),
    package_id UUID NOT NULL REFERENCES packages(id),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'USED')),
    used_listing_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- 8. LISTINGS
CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_number TEXT UNIQUE NOT NULL,
    seller_profile_id UUID NOT NULL REFERENCES character_profiles(id),
    corporate_profile_id UUID REFERENCES corporate_profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('vehicle', 'property')),
    subcategory TEXT NOT NULL,
    title VARCHAR(60) NOT NULL,
    description VARCHAR(100) NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'SOLD', 'REMOVED')),
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. VEHICLE DETAILS
CREATE TABLE IF NOT EXISTS vehicle_details (
    listing_id UUID PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    vehicle_category TEXT NOT NULL CHECK (vehicle_category IN ('Otomobil', 'SUV / Off-Road / Kamyonet', 'Motosiklet')),
    brand TEXT,
    model TEXT NOT NULL,
    plate TEXT NOT NULL,
    mileage INTEGER NOT NULL CHECK (mileage >= 0),
    engine_upgrade SMALLINT NOT NULL DEFAULT 0 CHECK (engine_upgrade BETWEEN 0 AND 4),
    transmission_upgrade SMALLINT NOT NULL DEFAULT 0 CHECK (transmission_upgrade BETWEEN 0 AND 4),
    brake_upgrade SMALLINT NOT NULL DEFAULT 0 CHECK (brake_upgrade BETWEEN 0 AND 4),
    turbo BOOLEAN NOT NULL DEFAULT FALSE,
    subwoofer BOOLEAN NOT NULL DEFAULT FALSE,
    trade_available BOOLEAN NOT NULL DEFAULT FALSE
);

-- 10. PROPERTY DETAILS
CREATE TABLE IF NOT EXISTS property_details (
    listing_id UUID PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    property_type TEXT NOT NULL CHECK (property_type IN ('Ev / Daire', 'İşyeri', 'Diğer Mülk')),
    floor INTEGER NOT NULL,
    room_count TEXT NOT NULL,
    furnished BOOLEAN NOT NULL DEFAULT FALSE,
    building_type TEXT NOT NULL DEFAULT 'Normal' CHECK (building_type IN ('Normal', 'Dubleks')),
    balcony BOOLEAN NOT NULL DEFAULT FALSE
);

-- 11. LISTING IMAGES
CREATE TABLE IF NOT EXISTS listing_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    size_bytes INTEGER NOT NULL CHECK (size_bytes <= 2097152), -- 2 MB
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. FAVORITES
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES character_profiles(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, listing_id)
);

-- 13. REPORTS
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_profile_id UUID NOT NULL REFERENCES character_profiles(id),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('Yanlış bilgi', 'Uygunsuz içerik', 'Şüpheli ilan', 'Diğer')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. SUPPORT TICKETS (Destek & Ticket Sistemi)
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES character_profiles(id) ON DELETE CASCADE,
    creator_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ANSWERED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. TICKET MESSAGES
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('USER', 'ADMIN')),
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. SOLD LISTING AUDIT
CREATE TABLE IF NOT EXISTS sold_listing_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_listing_id UUID NOT NULL,
    seller_profile_id UUID NOT NULL,
    payment_id UUID,
    sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_listings_public_active ON listings (status, expires_at) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings (category);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings (price);
CREATE INDEX IF NOT EXISTS idx_listings_corporate ON listings (corporate_profile_id);
CREATE INDEX IF NOT EXISTS idx_favorites_lookup ON favorites (profile_id, listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_credits_lookup ON listing_credits (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_profile ON support_tickets (profile_id, status);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Public can only view ACTIVE listings where expires_at > NOW()
CREATE POLICY "Public can view active valid listings" ON listings
    FOR SELECT
    USING (status = 'ACTIVE' AND expires_at > NOW());

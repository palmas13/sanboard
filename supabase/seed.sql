-- Sanboard Seed Data for Local Development & Testing

-- 1. Default Package
INSERT INTO packages (id, code, name, price, duration_days, active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'STANDARD_7_DAY', '7 Günlük Standart İlan', 2000, 7, true)
ON CONFLICT (code) DO NOTHING;

-- 2. Mock Users
INSERT INTO users (id, provider, external_user_id, role, status)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'GTAWORLD', 'gta-user-1', 'ADMIN', 'ACTIVE'),
  ('33333333-3333-3333-3333-333333333333', 'GTAWORLD', 'gta-user-2', 'USER', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 3. Character Profiles
INSERT INTO character_profiles (id, user_id, full_name, avatar_url, sanmail_email, phone, is_dealer, dealer_id)
VALUES
  (
    '44444444-4444-4444-4444-444444444441',
    '22222222-2222-2222-2222-222222222222',
    'Mavis Pierce',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80',
    'mavis.pierce@sanmail.com',
    '555-0192',
    true,
    '77777777-7777-7777-7777-777777777771'
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '33333333-3333-3333-3333-333333333333',
    'Zade Vexnera',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250&auto=format&fit=crop&q=80',
    'zade.vexnera@sanmail.com',
    '555-8831',
    false,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- 4. Corporate Profile (Galeri / Mağaza)
INSERT INTO corporate_profiles (
  id, owner_profile_id, company_name, slug, description, logo_url, banner_url, phone, email, address, is_premium, is_verified, status
) VALUES (
  '77777777-7777-7777-7777-777777777771',
  '44444444-4444-4444-4444-444444444441',
  'Apex Motors & Luxury Estates',
  'apex-motors',
  'Los Santos genelinde lüks otomobil ve seçkin mülk portföyü ile kurumsal hizmet sunuyoruz.',
  'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&auto=format&fit=crop&q=80',
  '555-0192',
  'apex.motors@sanmail.com',
  'Vinewood Boulevard No: 12, Vinewood Hills',
  true,
  true,
  'APPROVED'
) ON CONFLICT (id) DO NOTHING;

-- 5. Active Vehicle Listing: Benefactor Schafter V12
INSERT INTO listings (
  id, listing_number, seller_profile_id, corporate_profile_id, category, subcategory, title, description, price, location, status, published_at, expires_at
) VALUES (
  '55555555-5555-5555-5555-555555555501',
  '#SB-100028',
  '44444444-4444-4444-4444-444444444441',
  '77777777-7777-7777-7777-777777777771',
  'vehicle',
  'Otomobil',
  'FULL GELİŞTİRME • DÜŞÜK KM • TEMİZ SCHAFTER V12',
  'Kusursuz kondisyonda, garaj arabasıdır. Tüm bakımları Los Santos Customs tarafından yapılmıştır.',
  85000,
  'Vinewood',
  'ACTIVE',
  NOW() - INTERVAL '1 DAY',
  NOW() + INTERVAL '6 DAYS'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicle_details (
  listing_id, vehicle_category, brand, model, plate, mileage, engine_upgrade, transmission_upgrade, brake_upgrade, turbo, subwoofer, trade_available
) VALUES (
  '55555555-5555-5555-5555-555555555501',
  'Otomobil',
  'Benefactor',
  'Schafter V12',
  '62LS901',
  4200,
  4,
  3,
  4,
  true,
  true,
  true
) ON CONFLICT (listing_id) DO NOTHING;

INSERT INTO listing_images (id, listing_id, storage_path, sort_order, is_cover, size_bytes)
VALUES
  ('66666666-6666-6666-6666-666666666601', '55555555-5555-5555-5555-555555555501', 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=900&auto=format&fit=crop&q=80', 0, true, 850000),
  ('66666666-6666-6666-6666-666666666602', '55555555-5555-5555-5555-555555555501', 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=900&auto=format&fit=crop&q=80', 1, false, 790000)
ON CONFLICT (id) DO NOTHING;

-- 6. Active Property Listing: Rockford Hills Villa
INSERT INTO listings (
  id, listing_number, seller_profile_id, corporate_profile_id, category, subcategory, title, description, price, location, status, published_at, expires_at
) VALUES (
  '55555555-5555-5555-5555-555555555502',
  '#SB-100029',
  '44444444-4444-4444-4444-444444444442',
  NULL,
  'property',
  'Ev / Daire',
  'ROCKFORD HILLS MANZARALI LÜKS DUBLEKS DAİRE',
  'Şehrin en nezih bölgesinde, geniş teraslı ve güvenlikli lüks yaşam alanı.',
  450000,
  'Rockford Hills',
  'ACTIVE',
  NOW() - INTERVAL '2 DAYS',
  NOW() + INTERVAL '5 DAYS'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO property_details (
  listing_id, property_type, floor, room_count, furnished, building_type, balcony
) VALUES (
  '55555555-5555-5555-5555-555555555502',
  'Ev / Daire',
  12,
  '3+1',
  true,
  'Dubleks',
  true
) ON CONFLICT (listing_id) DO NOTHING;

INSERT INTO listing_images (id, listing_id, storage_path, sort_order, is_cover, size_bytes)
VALUES
  ('66666666-6666-6666-6666-666666666603', '55555555-5555-5555-5555-555555555502', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop&q=80', 0, true, 920000),
  ('66666666-6666-6666-6666-666666666604', '55555555-5555-5555-5555-555555555502', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&auto=format&fit=crop&q=80', 1, false, 840000)
ON CONFLICT (id) DO NOTHING;

-- 7. Favorites with user_id
INSERT INTO favorites (id, user_id, profile_id, listing_id)
VALUES
  ('88888888-8888-8888-8888-888888888801', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444442', '55555555-5555-5555-5555-555555555501')
ON CONFLICT (user_id, listing_id) DO NOTHING;

-- 8. Price History
INSERT INTO listing_price_history (id, listing_id, old_price, new_price, changed_at)
VALUES
  ('99999999-9999-9999-9999-999999999901', '55555555-5555-5555-5555-555555555501', 92000, 85000, NOW() - INTERVAL '12 HOURS')
ON CONFLICT (id) DO NOTHING;

-- 9. Notifications
INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id, metadata)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '33333333-3333-3333-3333-333333333333',
    'LISTING_PRICE_DROP',
    'Fiyat Düştü',
    'Favorilerinizdeki Benefactor Schafter V12 ilanının fiyatı $92.000 → $85.000 olarak güncellendi.',
    'listing',
    '55555555-5555-5555-5555-555555555501',
    '{"listingId": "55555555-5555-5555-5555-555555555501", "oldPrice": 92000, "newPrice": 85000}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 10. Support Tickets & Messages
INSERT INTO support_tickets (id, profile_id, creator_name, subject, status)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '44444444-4444-4444-4444-444444444442', 'Zade Vexnera', 'Görsel Yükleme Sorunu', 'ANSWERED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ticket_messages (id, ticket_id, sender_role, sender_name, message)
VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'USER', 'Zade Vexnera', 'Merhaba, ilan oluştururken 2MB üstü fotoğraflar yüklenmiyor mu? Bilgi alabilir miyim?'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'ADMIN', 'Sanboard Yönetimi', 'Merhaba Sayın Vexnera. Sanboard üzerinde ilan başına görsel sınırı 2MB ve toplam 3 fotoğraftır. Format olarak JPG veya PNG kullanabilirsiniz.')
ON CONFLICT (id) DO NOTHING;

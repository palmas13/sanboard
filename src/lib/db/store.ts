import {
  CharacterProfile,
  CharacterFleecaAccount,
  CorporateApplication,
  CorporateFollower,
  CorporateBoostCredit,
  DealerProfile,
  Favorite,
  Listing,
  ListingCredit,
  ListingPackage,
  ListingPriceHistory,
  Notification,
  Payment,
  Report,
  SoldListingAudit,
  SupportTicket,
  TicketMessage,
  User,
  OfferThread,
  OfferEvent,
} from '@/types';

// In-memory persistent state during server runtime
class SanboardDatabase {
  corporateBoostCredits: CorporateBoostCredit[] = [];
  offerThreads: OfferThread[] = [];
  offerEvents: OfferEvent[] = [];
  users: User[] = [
    {
      id: '22222222-2222-2222-2222-222222222222',
      provider: 'GTAWORLD',
      external_user_id: 'gta-mock-user-1',
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      provider: 'GTAWORLD',
      external_user_id: 'gta-mock-user-2',
      role: 'USER',
      status: 'ACTIVE',
      created_at: '2026-09-10T12:00:00Z',
      updated_at: '2026-09-10T12:00:00Z',
    },
    {
      id: 'usr-admin-1',
      provider: 'GTAWORLD',
      external_user_id: 'gta-mock-user-1',
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'usr-user-2',
      provider: 'GTAWORLD',
      external_user_id: 'gta-mock-user-2',
      role: 'USER',
      status: 'ACTIVE',
      created_at: '2026-09-10T12:00:00Z',
      updated_at: '2026-09-10T12:00:00Z',
    },
  ];

  profiles: CharacterProfile[] = [
    {
      id: 'char-mavis-01',
      user_id: 'usr-admin-1',
      external_character_id: 'char-mavis-01',
      full_name: 'Mavis Pierce',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80',
      sanmail_email: 'mavis.pierce@sanmail.com',
      phone: '5550192',
      role: 'ADMIN',
      is_dealer: true,
      dealer_id: 'dealer-apex-01',
      public_id: 1,
      created_at: '2026-09-01T10:05:00Z',
      updated_at: '2026-09-01T10:05:00Z',
    },
    {
      id: 'char-zade-02',
      user_id: 'usr-user-2',
      external_character_id: 'char-zade-02',
      full_name: 'Zade Vexnera',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250&auto=format&fit=crop&q=80',
      sanmail_email: 'zade.vexnera@sanmail.com',
      phone: '5558831',
      role: 'USER',
      public_id: 2,
      created_at: '2026-09-10T12:10:00Z',
      updated_at: '2026-09-10T12:10:00Z',
    },
    {
      id: 'char-ravi-03',
      user_id: 'usr-admin-1',
      external_character_id: 'char-ravi-03',
      full_name: 'Ravi Blumon',
      avatar_url: '',
      sanmail_email: 'ravi.blumon@sanmail.com',
      phone: '5557722',
      role: 'USER',
      public_id: 3,
      created_at: '2026-09-12T14:00:00Z',
      updated_at: '2026-09-12T14:00:00Z',
    },
  ];

  dealers: DealerProfile[] = [
    {
      id: 'dealer-apex-01',
      profile_id: 'char-mavis-01',
      owner_profile_id: 'char-mavis-01',
      company_name: 'Apex Motors & Luxury Estates',
      slug: 'apex-motors',
      description: 'Los Santos genelinde lüks otomobil ve seçkin mülk portföyü ile kurumsal hizmet sunuyoruz. Güvenilir ekspertiz ve hızlı devir.',
      logo_url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300&auto=format&fit=crop&q=80',
      banner_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&auto=format&fit=crop&q=80',
      address: 'Vinewood Boulevard No: 12, Vinewood Hills',
      phone: '5550192',
      sanmail_email: 'apex.motors@sanmail.com',
      purpose: 'Los Santos genelinde kurumsal otomobil galerisi ve emlak ofisi işletmek.',
      status: 'APPROVED',
      subscription_status: 'ACTIVE',
      subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      boost_credits: 3,
      purchased_boost_credits: 0,
      public_id: 1,
      social_media: {
        name: 'Facebrowser',
        url: 'https://facebrowser.gtaw/apexmotors',
      },
      created_at: '2026-09-02T10:00:00Z',
      updated_at: '2026-09-02T10:00:00Z',
    },
  ];

  applications: CorporateApplication[] = [];
  followers: CorporateFollower[] = [];

  packages: ListingPackage[] = [
    {
      id: 'pkg-standard-7-day',
      code: 'STANDARD_7_DAY',
      name: '7 Günlük Bireysel İlan',
      price: 1500,
      duration_days: 7,
      active: true,
      seller_type: 'INDIVIDUAL',
    },
    {
      id: 'pkg-corporate-14-day',
      code: 'CORPORATE_14_DAY',
      name: '14 Günlük Kurumsal İlan',
      price: 1250,
      duration_days: 14,
      active: true,
      seller_type: 'CORPORATE',
    },
    {
      id: 'pkg-listing-boost',
      code: 'LISTING_BOOST_24_HOUR',
      name: 'Boost Kredisi',
      price: 1000,
      duration_days: 1,
      active: true,
      seller_type: 'CORPORATE',
    },
    {
      id: 'pkg-corporate-subscription',
      code: 'CORPORATE_SUBSCRIPTION_30_DAY',
      name: 'Aylık Kurumsal Üyelik',
      price: 5500,
      duration_days: 30,
      active: true,
      seller_type: 'CORPORATE',
    },
    {
      id: 'pkg-corporate-plus-subscription',
      code: 'CORPORATE_PLUS_30_DAY',
      name: 'Corporate Plus',
      price: 25000,
      duration_days: 30,
      active: true,
      seller_type: 'CORPORATE',
    },
  ];

  payments: Payment[] = [
    {
      id: 'pay-001',
      order_id: 'ord-1001',
      profile_id: 'char-mavis-01',
      package_id: 'pkg-standard-7-day',
      provider: 'FLEECA',
      amount: 2000,
      status: 'SUCCESS',
      created_at: '2026-09-20T14:00:00Z',
      paid_at: '2026-09-20T14:01:00Z',
    },
    {
      id: 'pay-002',
      order_id: 'ord-1002',
      profile_id: 'char-zade-02',
      package_id: 'pkg-standard-7-day',
      provider: 'FLEECA',
      amount: 2000,
      status: 'SUCCESS',
      created_at: '2026-09-21T09:30:00Z',
      paid_at: '2026-09-21T09:31:00Z',
    },
  ];

  characterFleecaAccounts: CharacterFleecaAccount[] = [];

  credits: ListingCredit[] = [
    {
      id: 'crd-001',
      profile_id: 'char-mavis-01',
      payment_id: 'pay-001',
      package_id: 'pkg-standard-7-day',
      credit_type: 'INDIVIDUAL',
      status: 'USED',
      used_listing_id: 'lst-veh-01',
      created_at: '2026-09-20T14:01:00Z',
      used_at: '2026-09-20T14:05:00Z',
    },
    {
      id: 'crd-002',
      profile_id: 'char-mavis-01',
      payment_id: 'pay-001',
      package_id: 'pkg-standard-7-day',
      credit_type: 'INDIVIDUAL',
      status: 'AVAILABLE',
      created_at: '2026-09-22T10:00:00Z',
    },
  ];

  favorites: Favorite[] = [
    {
      id: 'fav-001',
      user_id: 'usr-admin-1',
      profile_id: 'char-mavis-01',
      listing_id: 'lst-prop-01',
      created_at: '2026-09-21T11:00:00Z',
    },
    {
      id: 'fav-002',
      user_id: 'usr-user-2',
      profile_id: 'char-zade-02',
      listing_id: 'lst-veh-01',
      created_at: '2026-09-21T15:30:00Z',
    },
    {
      id: 'fav-003',
      user_id: 'usr-admin-1',
      profile_id: 'char-mavis-01',
      listing_id: 'lst-veh-02',
      created_at: '2026-09-22T08:15:00Z',
    },
  ];

  priceHistories: ListingPriceHistory[] = [
    {
      id: 'lph-001',
      listing_id: 'lst-veh-01',
      old_price: 92000,
      new_price: 85000,
      changed_at: '2026-09-22T12:00:00Z',
    },
  ];

  notifications: Notification[] = [
    {
      id: 'notif-001',
      recipient_profile_id: 'char-mavis-01',
      user_id: 'usr-admin-1',
      type: 'LISTING_PRICE_DROP',
      title: 'Fiyat Düştü',
      message: 'Favorilerinizdeki Benefactor Schafter V12 ilanının fiyatı $92.000 → $85.000 olarak güncellendi.',
      entity_type: 'listing',
      entity_id: 'lst-veh-01',
      metadata: { listingId: 'lst-veh-01', oldPrice: 92000, newPrice: 85000 },
      read_at: null,
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-002',
      recipient_profile_id: 'char-zade-02',
      user_id: 'usr-user-2',
      type: 'SUPPORT_REPLY',
      title: 'Destek Talebiniz Yanıtlandı',
      message: '#tkt-1001 numaralı destek talebinize yönetici tarafından yanıt geldi.',
      entity_type: 'ticket',
      entity_id: 'tkt-1001',
      metadata: { ticketId: 'tkt-1001' },
      read_at: null,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
  ];

  reports: Report[] = [];
  soldAudits: SoldListingAudit[] = [];

  tickets: SupportTicket[] = [
    {
      id: 'tkt-1001',
      profile_id: 'char-zade-02',
      creator_name: 'Zade Vexnera',
      subject: 'İlan Fotoğrafı Boyut Sınırı Hakkında',
      status: 'ANSWERED',
      created_at: '2026-09-22T14:30:00Z',
      updated_at: '2026-09-22T15:00:00Z',
    },
  ];

  ticketMessages: TicketMessage[] = [
    {
      id: 'msg-01',
      ticket_id: 'tkt-1001',
      sender_role: 'USER',
      sender_name: 'Zade Vexnera',
      message: 'Merhaba, ilan eklerken 2 MB sınırına takılıyorum. Görselleri nasıl optimize edebilirim?',
      created_at: '2026-09-22T14:30:00Z',
    },
    {
      id: 'msg-02',
      ticket_id: 'tkt-1001',
      sender_role: 'ADMIN',
      sender_name: 'Sanboard Destek Ekibi',
      message: 'Merhaba Zade Bey, fotoğraflarınızı WebP formatına çevirerek veya çözünürlüğü makul seviyede tutarak kolayca 2 MB altına indirebilirsiniz.',
      created_at: '2026-09-22T15:00:00Z',
    },
  ];

  listings: Listing[] = [
    {
      id: 'lst-veh-01',
      listing_number: '#SB-100028',
      seller_profile_id: 'char-mavis-01',
      corporate_profile_id: 'dealer-apex-01',
      category: 'vehicle',
      subcategory: 'Otomobil',
      title: 'FULL GELİŞTİRME • DÜŞÜK KM • TEMİZ SCHAFTER V12',
      description: 'Kusursuz kondisyonda, garaj arabasıdır. Tüm bakımları Los Santos Customs tarafından yapılmıştır.',
      price: 85000,
      location: 'Vinewood',
      status: 'ACTIVE',
      published_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      images: [
        {
          id: 'img-v01-1',
          listing_id: 'lst-veh-01',
          storage_path: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=900&auto=format&fit=crop&q=80',
          sort_order: 0,
          is_cover: true,
          size_bytes: 850000,
          created_at: new Date().toISOString(),
        },
        {
          id: 'img-v01-2',
          listing_id: 'lst-veh-01',
          storage_path: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=900&auto=format&fit=crop&q=80',
          sort_order: 1,
          is_cover: false,
          size_bytes: 780000,
          created_at: new Date().toISOString(),
        },
      ],
      vehicle_details: {
        listing_id: 'lst-veh-01',
        vehicle_category: 'Otomobil',
        brand: 'Benefactor',
        model: 'Schafter V12',
        plate: '62LS901',
        mileage: 4200,
        engine_upgrade: 4,
        transmission_upgrade: 3,
        brake_upgrade: 4,
        turbo: true,
        subwoofer: true,
        trade_available: true,
      },
    },
    {
      id: 'lst-veh-02',
      listing_number: '#SB-100029',
      seller_profile_id: 'char-zade-02',
      category: 'vehicle',
      subcategory: 'SUV',
      title: 'ZIRHLI SEVİYE • DECLASSE GRANGER 3600LX',
      description: 'VIP koruma ve konvoy kullanımına uygun, hatasız orijinal zırhlı arazi aracı.',
      price: 135000,
      location: 'Rockford Hills',
      status: 'ACTIVE',
      published_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      images: [
        {
          id: 'img-v02-1',
          listing_id: 'lst-veh-02',
          storage_path: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=900&auto=format&fit=crop&q=80',
          sort_order: 0,
          is_cover: true,
          size_bytes: 920000,
          created_at: new Date().toISOString(),
        },
      ],
      vehicle_details: {
        listing_id: 'lst-veh-02',
        vehicle_category: 'SUV',
        brand: 'Declasse',
        model: 'Granger 3600LX',
        plate: 'VIP770',
        mileage: 7800,
        engine_upgrade: 3,
        transmission_upgrade: 2,
        brake_upgrade: 3,
        turbo: false,
        subwoofer: true,
        trade_available: false,
      },
    },
    {
      id: 'lst-veh-03',
      listing_number: '#SB-100030',
      seller_profile_id: 'char-mavis-01',
      category: 'vehicle',
      subcategory: 'Motosiklet',
      title: 'ÖZEL YAPIM WESTERN ZOMBIE CHOPPER',
      description: 'Özel egzoz sistemi, krom detaylar ve benzersiz sürüş hissi. Takas değerlendirilir.',
      price: 45000,
      location: 'Sandy Shores',
      status: 'ACTIVE',
      published_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      images: [
        {
          id: 'img-v03-1',
          listing_id: 'lst-veh-03',
          storage_path: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=900&auto=format&fit=crop&q=80',
          sort_order: 0,
          is_cover: true,
          size_bytes: 750000,
          created_at: new Date().toISOString(),
        },
      ],
      vehicle_details: {
        listing_id: 'lst-veh-03',
        vehicle_category: 'Motosiklet',
        brand: 'Western',
        model: 'Zombie Chopper',
        plate: 'MC899',
        mileage: 1800,
        engine_upgrade: 4,
        transmission_upgrade: 4,
        brake_upgrade: 4,
        turbo: false,
        subwoofer: false,
        trade_available: true,
      },
    },
    {
      id: 'lst-prop-01',
      listing_number: '#SB-100031',
      seller_profile_id: 'char-zade-02',
      category: 'property',
      subcategory: 'Ev / Daire',
      title: 'ROCKFORD HILLS MANZARALI LÜKS DUBLEKS DAİRE',
      description: 'Şehrin en nezih bölgesinde, geniş teraslı ve güvenlikli lüks yaşam alanı.',
      price: 450000,
      location: 'Rockford Hills',
      status: 'ACTIVE',
      published_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      images: [
        {
          id: 'img-p01-1',
          listing_id: 'lst-prop-01',
          storage_path: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop&q=80',
          sort_order: 0,
          is_cover: true,
          size_bytes: 920000,
          created_at: new Date().toISOString(),
        },
        {
          id: 'img-p01-2',
          listing_id: 'lst-prop-01',
          storage_path: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&auto=format&fit=crop&q=80',
          sort_order: 1,
          is_cover: false,
          size_bytes: 840000,
          created_at: new Date().toISOString(),
        },
      ],
      property_details: {
        listing_id: 'lst-prop-01',
        property_type: 'Ev / Daire',
        floor: 12,
        room_count: '3+1',
        furnished: true,
        market_value: 680000,
        furniture_value: 85000,
        building_type: 'Dubleks',
        balcony: true,
      },
    },
    {
      id: 'lst-prop-02',
      listing_number: '#SB-100032',
      seller_profile_id: 'char-mavis-01',
      category: 'property',
      subcategory: 'İşyeri',
      title: 'DOWNTOWN MERKEZİNDE HAZIR OFİS & ATÖLYE',
      description: 'Ana caddeye cephe, tabela değeri yüksek, kurumsal firmalara uygun ferah ofis.',
      price: 320000,
      location: 'Downtown Los Santos',
      status: 'ACTIVE',
      published_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      images: [
        {
          id: 'img-p02-1',
          listing_id: 'lst-prop-02',
          storage_path: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&auto=format&fit=crop&q=80',
          sort_order: 0,
          is_cover: true,
          size_bytes: 810000,
          created_at: new Date().toISOString(),
        },
      ],
      property_details: {
        listing_id: 'lst-prop-02',
        property_type: 'İşyeri',
        floor: 2,
        room_count: '4+1',
        furnished: true,
        market_value: 300000,
        furniture_value: 35000,
        building_type: 'Normal',
        balcony: false,
      },
    },
  ];

  auditLogs: Array<{
    id: string;
    event_type: string;
    user_id?: string | null;
    profile_id?: string | null;
    metadata?: Record<string, any>;
    created_at: string;
  }> = [];
}

// Singleton storage instance for application runtime
const globalForDb = globalThis as unknown as { sanboardDb?: SanboardDatabase };
export const db = globalForDb.sanboardDb || new SanboardDatabase();
if (process.env.NODE_ENV !== 'production') globalForDb.sanboardDb = db;

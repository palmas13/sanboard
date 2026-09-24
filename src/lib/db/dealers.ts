import { db } from './store';
import { DealerProfile, DealerStatus, Listing } from '@/types';

export function ensureDealers() {
  if (!db.dealers) {
    db.dealers = [
      {
        id: 'dealer-apex-01',
        profile_id: 'char-mavis-01',
        company_name: 'Apex Motors & Luxury Estates',
        slug: 'apex-motors',
        description: 'Los Santos genelinde lüks otomobil ve seçkin mülk portföyü ile 2024\'ten bu yana kurumsal hizmet sunuyoruz. Güvenilir ekspertiz ve hızlı devir.',
        logo_url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300&auto=format&fit=crop&q=80',
        banner_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&auto=format&fit=crop&q=80',
        address: 'Vinewood Boulevard No: 12, Vinewood Hills',
        phone: '555-0192',
        sanmail_email: 'apex.motors@sanmail.com',
        purpose: 'San Andreas genelinde kurumsal otomobil galerisi ve emlak ofisi işletmek.',
        status: 'APPROVED',
        created_at: '2026-09-02T10:00:00Z',
        updated_at: '2026-09-02T10:00:00Z',
      },
    ];
  }
}

import { getDealerRepository, getListingRepository } from './repositories';

export async function getDealerByProfileId(profileId: string): Promise<DealerProfile | null> {
  if (process.env.DATA_STORE === 'supabase') {
    return getDealerRepository().getDealerByProfileId(profileId) as any;
  }
  ensureDealers();
  return db.dealers.find((d) => d.profile_id === profileId) || null;
}

export async function getDealerById(dealerId: string): Promise<DealerProfile | null> {
  if (process.env.DATA_STORE === 'supabase') {
    return getDealerRepository().getDealerById(dealerId) as any;
  }
  ensureDealers();
  return db.dealers.find((d) => d.id === dealerId) || null;
}

export async function getDealerBySlug(slug: string): Promise<DealerProfile | null> {
  if (process.env.DATA_STORE === 'supabase') {
    return getDealerRepository().getDealerBySlug(slug) as any;
  }
  ensureDealers();
  return db.dealers.find((d) => d.slug === slug) || null;
}

export async function applyForDealer(params: {
  profileId: string;
  companyName: string;
  purpose: string;
}): Promise<{ success: boolean; dealer?: DealerProfile; error?: string }> {
  ensureDealers();
  const profile = db.profiles.find((p) => p.id === params.profileId);
  if (!profile) return { success: false, error: 'Profil bulunamadı.' };

  const existing = db.dealers.find((d) => d.profile_id === params.profileId);
  if (existing) {
    if (existing.status === 'PENDING') {
      return { success: false, error: 'Zaten beklemede olan bir kurumsal başvurunuz var.' };
    }
    if (existing.status === 'APPROVED') {
      return { success: false, error: 'Zaten onaylanmış bir kurumsal hesabınız bulunmaktadır.' };
    }
  }

  const id = `dealer-${Date.now()}`;
  const slug = params.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const newDealer: DealerProfile = {
    id,
    profile_id: params.profileId,
    company_name: params.companyName.trim(),
    slug,
    purpose: params.purpose.trim(),
    description: `${params.companyName.trim()} resmi Sanboard kurumsal satış vitrinidir.`,
    logo_url: profile.avatar_url || 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300',
    banner_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600',
    address: 'Los Santos, San Andreas',
    phone: profile.phone,
    sanmail_email: profile.sanmail_email,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.dealers.push(newDealer);
  return { success: true, dealer: newDealer };
}

export async function updateDealerProfile(
  dealerId: string,
  profileId: string,
  data: Partial<Pick<DealerProfile, 'company_name' | 'description' | 'logo_url' | 'banner_url' | 'address' | 'phone' | 'sanmail_email'>>
): Promise<{ success: boolean; dealer?: DealerProfile; error?: string }> {
  const dealer = db.dealers.find((d) => d.id === dealerId);
  if (!dealer) return { success: false, error: 'Kurumsal profil bulunamadı.' };

  if (dealer.profile_id !== profileId) {
    return { success: false, error: 'Bu kurumsal profili düzenleme yetkiniz yok.' };
  }

  if (data.company_name) dealer.company_name = data.company_name.trim();
  if (data.description !== undefined) dealer.description = data.description.trim();
  if (data.logo_url) dealer.logo_url = data.logo_url.trim();
  if (data.banner_url) dealer.banner_url = data.banner_url.trim();
  if (data.address) dealer.address = data.address.trim();
  if (data.phone) dealer.phone = data.phone.trim();
  if (data.sanmail_email) dealer.sanmail_email = data.sanmail_email.trim();
  dealer.updated_at = new Date().toISOString();

  return { success: true, dealer };
}

export async function getAllDealers(): Promise<DealerProfile[]> {
  ensureDealers();
  return [...db.dealers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateDealerStatus(
  dealerId: string,
  status: DealerStatus
): Promise<boolean> {
  ensureDealers();
  const dealer = db.dealers.find((d) => d.id === dealerId);
  if (!dealer) return false;

  dealer.status = status;
  dealer.updated_at = new Date().toISOString();

  // If approved, update character profile
  const profile = db.profiles.find((p) => p.id === dealer.profile_id);
  if (profile) {
    if (status === 'APPROVED') {
      profile.is_dealer = true;
      profile.dealer_id = dealerId;
    } else if (status === 'REJECTED') {
      profile.is_dealer = false;
      profile.dealer_id = undefined;
    }
  }

  return true;
}

export async function getDealerListings(profileId: string): Promise<{ vehicles: Listing[]; properties: Listing[] }> {
  if (process.env.DATA_STORE === 'supabase') {
    const all = await getListingRepository().getUserListings(profileId);
    return {
      vehicles: all.filter((l) => l.category === 'vehicle' && l.status === 'ACTIVE'),
      properties: all.filter((l) => l.category === 'property' && l.status === 'ACTIVE'),
    };
  }
  const now = new Date();
  const all = db.listings.filter(
    (l) => l.seller_profile_id === profileId && l.status === 'ACTIVE' && l.expires_at && new Date(l.expires_at) > now
  );

  return {
    vehicles: all.filter((l) => l.category === 'vehicle'),
    properties: all.filter((l) => l.category === 'property'),
  };
}

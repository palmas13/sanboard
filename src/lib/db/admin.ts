import { db } from './store';
import { CharacterProfile, Listing, Report, User } from '@/types';
import { getSupabaseAdminClient } from './supabase-client';
import { getListingRepository } from './repositories';

export interface AdminStats {
  totalUsers: number;
  totalProfiles: number;
  /** Compatibility alias for clients that label profiles as characters. */
  totalCharacters: number;
  activeListings: number;
  corporateProfiles: number;
  pendingCorporateApplications: number;
  /** Tickets awaiting an admin response. ANSWERED waits on the requester and is not open admin work. */
  openTickets: number;
  openReports: number;
  expiredListings: number;
  totalRevenue: number;
  todayListings: number;
  totalFavorites: number;
}

export interface AdminUserSummary {
  user: User;
  profileCount: number;
  characters: Pick<CharacterProfile, 'id' | 'full_name' | 'avatar_path' | 'avatar_url' | 'public_id' | 'role' | 'created_at'>[];
}

export interface AdminReport extends Report {
  reporter: Pick<CharacterProfile, 'id' | 'full_name' | 'avatar_path' | 'avatar_url' | 'public_id'> | null;
  listing: (Pick<Listing, 'id' | 'public_id' | 'listing_number' | 'title' | 'status' | 'seller_profile_id'> & {
    owner: Pick<CharacterProfile, 'id' | 'full_name' | 'avatar_path' | 'avatar_url' | 'public_id'> | null;
  }) | null;
}

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const nowIso = now.toISOString();
      const startOfDayIso = startOfDay.toISOString();

      const [
        profilesRes,
        activeListingsRes,
        corporateProfilesRes,
        pendingApplicationsRes,
        openTicketsRes,
        openReportsRes,
        expiredListingsRes,
        paymentsRes,
        todayListingsRes,
        favoritesRes,
      ] = await Promise.all([
        client.from('character_profiles').select('*', { count: 'exact', head: true }),
        client.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').or(`expires_at.is.null,expires_at.gt.${nowIso}`),
        client.from('corporate_profiles').select('*', { count: 'exact', head: true }),
        client.from('corporate_applications').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        client.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
        client.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        client.from('listings').select('*', { count: 'exact', head: true }).or(`status.eq.EXPIRED,expires_at.lte.${nowIso}`),
        client.from('payments').select('amount').eq('status', 'SUCCESS'),
        client.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', startOfDayIso),
        client.from('favorites').select('*', { count: 'exact', head: true }),
      ]);

      const totalRevenue = (paymentsRes.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      return {
        totalUsers: profilesRes.count || 0,
        totalProfiles: profilesRes.count || 0,
        totalCharacters: profilesRes.count || 0,
        activeListings: activeListingsRes.count || 0,
        corporateProfiles: corporateProfilesRes.count || 0,
        pendingCorporateApplications: pendingApplicationsRes.count || 0,
        openTickets: openTicketsRes.count || 0,
        openReports: openReportsRes.count || 0,
        expiredListings: expiredListingsRes.count || 0,
        totalRevenue,
        todayListings: todayListingsRes.count || 0,
        totalFavorites: favoritesRes.count || 0,
      };
    }
  }

  let activeCount = 0;
  let expiredCount = 0;
  let todayCount = 0;

  for (const l of db.listings) {
    const isExpired = l.expires_at ? new Date(l.expires_at) <= now : false;
    if (l.status === 'ACTIVE' && !isExpired) {
      activeCount++;
    } else if (l.status === 'EXPIRED' || (l.status === 'ACTIVE' && isExpired)) {
      expiredCount++;
    }

    const createdTime = new Date(l.created_at).getTime();
    if (createdTime >= startOfDay.getTime()) {
      todayCount++;
    }
  }

  const totalRevenue = db.payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    totalUsers: db.profiles.length,
    totalProfiles: db.profiles.length,
    totalCharacters: db.profiles.length,
    activeListings: activeCount,
    corporateProfiles: db.dealers.length,
    pendingCorporateApplications: db.applications.filter((application) => application.status === 'PENDING').length,
    openTickets: db.tickets.filter((ticket) => ticket.status === 'OPEN').length,
    openReports: db.reports.filter((report) => report.status === 'PENDING').length,
    expiredListings: expiredCount,
    totalRevenue,
    todayListings: todayCount,
    totalFavorites: db.favorites.length,
  };
}

export async function getAllListingsForAdmin(): Promise<Listing[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { data, error } = await client
        .from('listings')
        .select(`
          *,
          vehicle_details (*),
          property_details (*),
          listing_images (*),
          seller:character_profiles (*),
          corporate:corporate_profiles (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((l: any) => ({
        ...l,
        images: l.listing_images || [],
        dealer: l.corporate || undefined,
      })) as Listing[];
    }
  }

  return [...db.listings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function adminDelistListing(listingId: string): Promise<boolean> {
  const repo = getListingRepository();
  const result = repo.removeListing
    ? await repo.removeListing(listingId, 'SYSTEM_ADMIN')
    : await repo.closeListing(listingId, 'SYSTEM_ADMIN', 'REMOVED', 'OTHER');
  return result.success;
}

export async function getRecentCharacterProfiles(limit = 6): Promise<Pick<CharacterProfile, 'id' | 'full_name' | 'created_at' | 'role'>[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { data, error } = await client
        .from('character_profiles')
        .select('id, full_name, created_at, role')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    }
  }
  return [...db.profiles]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function getAllUsersForAdmin(): Promise<AdminUserSummary[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { data, error } = await client
        .from('users')
        .select(`
          *,
          character_profiles (id, full_name, avatar_path, avatar_url, public_id, role, created_at)
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((u: any) => ({
        user: {
          id: u.id,
          provider: u.provider,
          external_user_id: u.external_user_id,
          role: u.role,
          status: u.status,
          created_at: u.created_at,
          updated_at: u.updated_at,
        },
        profileCount: u.character_profiles?.length || 0,
        characters: u.character_profiles || [],
      }));
    }
  }

  return db.users.map((u) => {
    const characters = db.profiles.filter((p) => p.user_id === u.id);
    return { user: u, profileCount: characters.length, characters };
  });
}

export async function toggleUserBan(userId: string): Promise<boolean> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { data: user } = await client.from('users').select('status').eq('id', userId).single();
      if (!user) return false;

      const nextStatus = user.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
      const { error } = await client
        .from('users')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      return !error;
    }
  }

  const user = db.users.find((u) => u.id === userId);
  if (!user) return false;

  user.status = user.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
  user.updated_at = new Date().toISOString();
  return true;
}

export async function updatePackagePrice(packageCode: string, newPrice: number): Promise<boolean> {
  if (newPrice <= 0) return false;

  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { error } = await client
        .from('packages')
        .update({ price: Math.round(newPrice) })
        .eq('code', packageCode);

      return !error;
    }
  }

  const pkg = db.packages.find((p) => p.code === packageCode);
  if (!pkg) return false;

  pkg.price = Math.round(newPrice);
  return true;
}

export async function getReportsForAdmin(): Promise<AdminReport[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { data, error } = await client
        .from('reports')
        .select(`
          *,
          reporter:character_profiles!reports_reporter_profile_id_fkey(id, full_name, avatar_path, avatar_url, public_id),
          listing:listings!reports_listing_id_fkey(
            id, public_id, listing_number, title, status, seller_profile_id,
            owner:character_profiles!listings_seller_profile_id_fkey(id, full_name, avatar_path, avatar_url, public_id)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Raporlar alınamadı: ${error.message}`);
      return (data || []).map((report: any) => ({
        ...report,
        listing: report.listing || report.listing_snapshot || null,
        listing_id: report.listing_id || report.historical_listing_id,
      })) as AdminReport[];
    }
  }

  return [...db.reports].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).map((report) => ({
    ...report,
    reporter: db.profiles.find((profile) => profile.id === report.reporter_profile_id) || null,
    listing: (() => {
      const listing = db.listings.find((item) => item.id === report.listing_id);
      if (!listing) return null;
      return {
        ...listing,
        owner: db.profiles.find((profile) => profile.id === listing.seller_profile_id) || null,
      };
    })(),
  }));
}

export async function updateReportStatus(reportId: string, status: 'RESOLVED' | 'DISMISSED'): Promise<boolean> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { error } = await client
        .from('reports')
        .update({ status })
        .eq('id', reportId);

      return !error;
    }
  }

  const report = db.reports.find((r) => r.id === reportId);
  if (!report) return false;

  report.status = status;
  return true;
}

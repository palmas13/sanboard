import { db } from './store';
import { Listing, Report, User } from '@/types';
import { getSupabaseAdminClient } from './supabase-client';

export interface AdminStats {
  totalUsers: number;
  activeListings: number;
  expiredListings: number;
  totalRevenue: number;
  todayListings: number;
  totalFavorites: number;
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
        usersRes,
        activeListingsRes,
        expiredListingsRes,
        paymentsRes,
        todayListingsRes,
        favoritesRes,
      ] = await Promise.all([
        client.from('users').select('*', { count: 'exact', head: true }),
        client.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').gt('expires_at', nowIso),
        client.from('listings').select('*', { count: 'exact', head: true }).or(`status.eq.EXPIRED,expires_at.lte.${nowIso}`),
        client.from('payments').select('amount').eq('status', 'SUCCESS'),
        client.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', startOfDayIso),
        client.from('favorites').select('*', { count: 'exact', head: true }),
      ]);

      const totalRevenue = (paymentsRes.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      return {
        totalUsers: usersRes.count || 0,
        activeListings: activeListingsRes.count || 0,
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
    totalUsers: db.users.length,
    activeListings: activeCount,
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
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { error } = await client
        .from('listings')
        .update({ status: 'REMOVED', updated_at: new Date().toISOString() })
        .eq('id', listingId);

      return !error;
    }
  }

  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) return false;

  listing.status = 'REMOVED';
  listing.updated_at = new Date().toISOString();
  return true;
}

export async function getAllUsersForAdmin(): Promise<{ user: User; profileCount: number }[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { data, error } = await client
        .from('users')
        .select(`
          *,
          character_profiles (id, full_name, avatar_path, public_id)
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

export async function getReportsForAdmin(): Promise<Report[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const { data, error } = await client
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []) as Report[];
    }
  }

  return db.reports.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
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

import { db } from './store';
import { Listing, Payment, Report, User } from '@/types';

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
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

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
    if (createdTime >= startOfDay) {
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
  return [...db.listings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function adminDelistListing(listingId: string): Promise<boolean> {
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) return false;

  listing.status = 'REMOVED';
  listing.updated_at = new Date().toISOString();
  return true;
}

export async function getAllUsersForAdmin(): Promise<{ user: User; profileCount: number }[]> {
  return db.users.map((u) => {
    const profileCount = db.profiles.filter((p) => p.user_id === u.id).length;
    return { user: u, profileCount };
  });
}

export async function toggleUserBan(userId: string): Promise<boolean> {
  const user = db.users.find((u) => u.id === userId);
  if (!user) return false;

  user.status = user.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
  user.updated_at = new Date().toISOString();
  return true;
}

export async function updatePackagePrice(packageCode: string, newPrice: number): Promise<boolean> {
  if (newPrice <= 0) return false;
  const pkg = db.packages.find((p) => p.code === packageCode);
  if (!pkg) return false;

  pkg.price = Math.round(newPrice);
  return true;
}

export async function getReportsForAdmin(): Promise<Report[]> {
  return db.reports.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateReportStatus(reportId: string, status: 'RESOLVED' | 'DISMISSED'): Promise<boolean> {
  const report = db.reports.find((r) => r.id === reportId);
  if (!report) return false;

  report.status = status;
  return true;
}

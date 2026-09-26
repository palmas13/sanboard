import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminStats,
  getAllListingsForAdmin,
  getAllUsersForAdmin,
  getReportsForAdmin,
  adminDelistListing,
  toggleUserBan,
  updatePackagePrice,
  updateReportStatus,
} from '@/lib/db/admin';
import {
  getAllDealers,
  updateDealerStatus,
  getAllApplications,
  reviewApplication,
  suspendCorporateStore,
  reactivateCorporateStore,
  deleteCorporateStore,
} from '@/lib/db/dealers';
import { getAllTicketsForAdmin, updateTicketStatus, addTicketMessage } from '@/lib/db/tickets';
import { db } from '@/lib/db/store';
import { getServerSession } from '@/lib/auth/session';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

async function getAdminActorProfileId(req: NextRequest): Promise<string> {
  const actor = await resolveOwnedActiveProfile(req);
  return actor.ok ? actor.profileId : 'SYSTEM_ADMIN';
}

async function checkAdminAccess(req: NextRequest): Promise<boolean> {
  // Internal secret header for backend service calls
  const secretHeader = req.headers.get('x-sanboard-secret');
  if (secretHeader && process.env.SUPABASE_SECRET_KEY && secretHeader === process.env.SUPABASE_SECRET_KEY) {
    return true;
  }

  const actor = await resolveOwnedActiveProfile(req);
  return actor.ok && actor.role === 'ADMIN';
}

export async function GET(req: NextRequest) {
  if (!(await checkAdminAccess(req))) {
    return NextResponse.json(
      { error: 'Yetkisiz erişim. Bu alana yalnızca Sanboard yöneticileri erişebilir.' },
      { status: 403 }
    );
  }

  try {
    const [stats, listings, users, reports, rawDealers, rawApplications, tickets] = await Promise.all([
      getAdminStats(),
      getAllListingsForAdmin(),
      getAllUsersForAdmin(),
      getReportsForAdmin(),
      getAllDealers(),
      getAllApplications(),
      getAllTicketsForAdmin(),
    ]);

    // Section 12 & 24: PENDING applications only for application review
    const pendingApps = (rawApplications || []).filter((a) => a.status === 'PENDING');
    const enrichedApplications = await Promise.all(
      pendingApps.map(async (app: any) => {
        let applicantName = 'Bilinmeyen';
        if (process.env.DATA_STORE === 'supabase') {
          try {
            const { getSupabaseAdminClient } = await import('@/lib/db/supabase-client');
            const client = getSupabaseAdminClient();
            if (client) {
              const { data: p } = await client
                .from('character_profiles')
                .select('full_name')
                .eq('id', app.applicant_profile_id)
                .maybeSingle();
              if (p?.full_name) applicantName = p.full_name;
            }
          } catch {}
        } else {
          const p = db.profiles.find((x) => x.id === app.applicant_profile_id);
          if (p) applicantName = p.full_name;
        }
        return {
          ...app,
          applicant_name: applicantName,
        };
      })
    );

    // Section 12 & 23: Existing corporate stores enriched with status chips & counts
    const enrichedDealers = await Promise.all(
      (rawDealers || []).map(async (d: any) => {
        const ownerId = d.owner_profile_id || d.profile_id;
        let ownerName = 'Bilinmeyen Karakter';
        let activeListingCount = 0;
        let followerCount = d.follower_count || 0;

        if (process.env.DATA_STORE === 'supabase') {
          try {
            const { getSupabaseAdminClient } = await import('@/lib/db/supabase-client');
            const client = getSupabaseAdminClient();
            if (client) {
              const [ownerRes, listingsRes, followerRes] = await Promise.all([
                client.from('character_profiles').select('full_name').eq('id', ownerId).maybeSingle(),
                client
                  .from('listings')
                  .select('id', { count: 'exact', head: true })
                  .eq('corporate_profile_id', d.id)
                  .eq('status', 'ACTIVE'),
                client
                  .from('corporate_followers')
                  .select('id', { count: 'exact', head: true })
                  .eq('corporate_profile_id', d.id),
              ]);
              if (ownerRes.data?.full_name) ownerName = ownerRes.data.full_name;
              if (listingsRes.count !== null && listingsRes.count !== undefined) activeListingCount = listingsRes.count;
              if (followerRes.count !== null && followerRes.count !== undefined) followerCount = followerRes.count;
            }
          } catch {}
        } else {
          const char = db.profiles.find((p) => p.id === ownerId);
          if (char) ownerName = char.full_name;
          activeListingCount = (db.listings || []).filter(
            (l) => l.corporate_profile_id === d.id && l.status === 'ACTIVE'
          ).length;
          followerCount = (db.followers || []).filter((f) => f.corporate_profile_id === d.id).length;
        }

        return {
          ...d,
          moderation_status: d.moderation_status || 'ACTIVE',
          subscription_status: d.subscription_status || 'INACTIVE',
          owner_character_name: ownerName,
          active_listing_count: activeListingCount,
          follower_count: followerCount,
        };
      })
    );

    let payments = db.payments;
    let packagePrice = 2000;
    if (process.env.DATA_STORE === 'supabase') {
      const { getSupabaseAdminClient } = await import('@/lib/db/supabase-client');
      const client = getSupabaseAdminClient();
      if (client) {
        const [payRes, pkgRes] = await Promise.all([
          client.from('payments').select('*').order('created_at', { ascending: false }),
          client.from('packages').select('price').eq('code', 'STANDARD_7_DAY').maybeSingle(),
        ]);
        if (payRes.data) payments = payRes.data as any;
        if (pkgRes.data?.price) packagePrice = pkgRes.data.price;
      }
    } else {
      const standardPackage = db.packages.find((p) => p.code === 'STANDARD_7_DAY');
      packagePrice = standardPackage?.price || 2000;
    }

    return NextResponse.json({
      stats,
      listings,
      users,
      reports,
      dealers: enrichedDealers,
      applications: enrichedApplications,
      tickets,
      payments,
      packagePrice,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Admin verileri getirilemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAdminAccess(req))) {
    return NextResponse.json(
      { error: 'Yetkisiz erişim. Bu alana yalnızca Sanboard yöneticileri erişebilir.' },
      { status: 403 }
    );
  }

  try {
    const { action, payload } = await req.json();
    const adminActorProfileId = await getAdminActorProfileId(req);

    switch (action) {
      case 'delist': {
        const success = await adminDelistListing(payload.listingId);
        try {
          const { revalidatePath } = await import('next/cache');
          revalidatePath('/');
          revalidatePath('/arac');
          revalidatePath('/mulk');
          revalidatePath(`/ilan/${payload.listingId}`);
        } catch {}
        return NextResponse.json({ success });
      }

      case 'toggleBan': {
        const success = await toggleUserBan(payload.userId);
        return NextResponse.json({ success });
      }

      case 'updatePrice': {
        const success = await updatePackagePrice(
          'STANDARD_7_DAY',
          Number(payload.newPrice)
        );
        return NextResponse.json({ success });
      }

      case 'updateReport': {
        const success = await updateReportStatus(
          payload.reportId,
          payload.status
        );
        return NextResponse.json({ success });
      }

      // Application Review: Approve
      case 'approveApplication': {
        const result = await reviewApplication(
          payload.applicationId,
          'APPROVED',
          undefined,
          adminActorProfileId
        );
        return NextResponse.json(result);
      }

      // Application Review: Reject (requires reason)
      case 'rejectApplication': {
        if (!payload.rejectionReason?.trim()) {
          return NextResponse.json({ error: 'Red gerekçesi zorunludur.' }, { status: 400 });
        }
        const result = await reviewApplication(
          payload.applicationId,
          'REJECTED',
          payload.rejectionReason,
          adminActorProfileId
        );
        return NextResponse.json(result);
      }

      // Store Moderation: Suspend (Section 14 & 15)
      case 'suspendStore': {
        if (!payload.reason?.trim()) {
          return NextResponse.json({ error: 'Askıya alma nedeni zorunludur.' }, { status: 400 });
        }
        const result = await suspendCorporateStore(
          payload.dealerId,
          payload.reason,
          adminActorProfileId
        );
        try {
          const { revalidatePath } = await import('next/cache');
          revalidatePath('/');
          revalidatePath('/arac');
          revalidatePath('/mulk');
          revalidatePath('/hesabim');
          revalidatePath('/hesabim/kurumsal');
          revalidatePath('/yonetim');
          if (payload.dealerId) {
            revalidatePath(`/premium/${payload.dealerId}`);
          }
        } catch {}
        return NextResponse.json(result);
      }

      // Store Moderation: Reactivate (Section 15)
      case 'reactivateStore': {
        const result = await reactivateCorporateStore(
          payload.dealerId,
          adminActorProfileId
        );
        try {
          const { revalidatePath } = await import('next/cache');
          revalidatePath('/');
          revalidatePath('/arac');
          revalidatePath('/mulk');
          revalidatePath('/hesabim');
          revalidatePath('/hesabim/kurumsal');
          revalidatePath('/yonetim');
          if (payload.dealerId) {
            revalidatePath(`/premium/${payload.dealerId}`);
          }
        } catch {}
        return NextResponse.json(result);
      }

      // Store Moderation: Delete (Section 16 - soft delete & cache invalidation)
      case 'deleteStore': {
        if (!payload.reason?.trim()) {
          return NextResponse.json({ error: 'Silme gerekçesi zorunludur.' }, { status: 400 });
        }
        const result = await deleteCorporateStore(
          payload.dealerId,
          payload.reason,
          adminActorProfileId
        );
        try {
          const { revalidatePath } = await import('next/cache');
          revalidatePath('/');
          revalidatePath('/arac');
          revalidatePath('/mulk');
          revalidatePath('/hesabim');
          revalidatePath('/hesabim/kurumsal');
          revalidatePath('/yonetim');
          if (payload.dealerId) {
            revalidatePath(`/premium/${payload.dealerId}`);
          }
        } catch {}
        return NextResponse.json(result);
      }

      case 'updateDealer': {
        const success = await updateDealerStatus(
          payload.dealerId,
          payload.status,
          payload.rejectionReason
        );
        return NextResponse.json({ success });
      }

      case 'updateTicket': {
        const success = await updateTicketStatus(
          payload.ticketId,
          payload.status
        );
        return NextResponse.json({ success });
      }

      case 'adminReplyTicket': {
        const result = await addTicketMessage({
          ticketId: payload.ticketId,
          senderRole: 'ADMIN',
          senderName: 'Sanboard Yönetimi',
          message: payload.message,
        });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    );
  }
}

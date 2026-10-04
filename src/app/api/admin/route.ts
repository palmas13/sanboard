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
  getRecentCharacterProfiles,
} from '@/lib/db/admin';
import {
  getAllDealers,
  updateDealerStatus,
  getAllApplications,
  reviewApplication,
  suspendCorporateStore,
  reactivateCorporateStore,
  deleteCorporateStore,
  manuallyActivateCorporateSubscription,
} from '@/lib/db/dealers';
import { getAllTicketsForAdmin, updateTicketStatus, addTicketMessage } from '@/lib/db/tickets';
import { db } from '@/lib/db/store';
import { resolveActiveAdmin } from '@/lib/auth/active-profile';
import { getUserRepository } from '@/lib/db/repositories';
import { recordAuditEvent } from '@/lib/audit';
import type { TicketStatus } from '@/types';

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  return origin === req.nextUrl.origin;
}

function safeMutationResult(result: { success: boolean; [key: string]: unknown }, error: string) {
  const domainError = typeof result.error === 'string' && result.error.trim() ? result.error : error;
  return NextResponse.json(result.success ? result : { success: false, error: domainError }, { status: result.success ? 200 : 400 });
}

export async function GET(req: NextRequest) {
  const actor = await resolveActiveAdmin(req);
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

  try {
    const [stats, listings, users, recentCharacters, reports, rawDealers, rawApplications, tickets] = await Promise.all([
      getAdminStats(),
      getAllListingsForAdmin(),
      getAllUsersForAdmin(),
      getRecentCharacterProfiles(6),
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
      summary: stats,
      stats,
      listings,
      users,
      recentCharacters,
      reports,
      dealers: enrichedDealers,
      applications: enrichedApplications,
      tickets,
      payments,
      packagePrice,
    });
  } catch {
    return NextResponse.json(
      { error: 'Admin verileri getirilemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const actor = await resolveActiveAdmin(req);
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 });

  try {
    const { action, payload = {} } = await req.json();
    const adminActorProfileId = actor.profileId;

    switch (action) {
      case 'delist': {
        if (!payload.listingId) return NextResponse.json({ error: 'listingId zorunludur.' }, { status: 400 });
        const success = await adminDelistListing(payload.listingId);
        if (success) await recordAuditEvent({ eventType: 'ADMIN_LISTING_DELISTED', userId: actor.userId, profileId: adminActorProfileId, metadata: { targetType: 'listing', targetId: payload.listingId } });
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
        if (!payload.userId) return NextResponse.json({ error: 'userId zorunludur.' }, { status: 400 });
        const success = await toggleUserBan(payload.userId);
        if (success) await recordAuditEvent({ eventType: 'ADMIN_ACCOUNT_STATUS_CHANGED', userId: actor.userId, profileId: adminActorProfileId, metadata: { targetType: 'account', targetId: payload.userId } });
        return NextResponse.json({ success });
      }

      case 'updatePrice': {
        const newPrice = Number(payload.newPrice);
        if (!Number.isSafeInteger(newPrice) || newPrice <= 0) return NextResponse.json({ error: 'Geçerli bir paket fiyatı zorunludur.' }, { status: 400 });
        const success = await updatePackagePrice(
          'STANDARD_7_DAY',
          newPrice
        );
        if (success) await recordAuditEvent({ eventType: 'ADMIN_PACKAGE_PRICE_CHANGED', userId: actor.userId, profileId: adminActorProfileId, metadata: { targetType: 'package', targetId: 'STANDARD_7_DAY', newPrice: Number(payload.newPrice) } });
        return NextResponse.json({ success });
      }

      case 'updateReport': {
        if (!payload.reportId || typeof payload.reportId !== 'string') return NextResponse.json({ error: 'reportId zorunludur.' }, { status: 400 });
        if (!['RESOLVED', 'DISMISSED'].includes(payload.status)) return NextResponse.json({ error: 'Geçersiz rapor durumu.' }, { status: 400 });
        const success = await updateReportStatus(
          payload.reportId,
          payload.status
        );
        if (success) await recordAuditEvent({ eventType: 'ADMIN_REPORT_STATUS_CHANGED', userId: actor.userId, profileId: adminActorProfileId, metadata: { targetType: 'report', targetId: payload.reportId, status: payload.status } });
        return NextResponse.json({ success });
      }

      // Application Review: Approve
      case 'approveApplication': {
        if (!payload.applicationId || typeof payload.applicationId !== 'string') return NextResponse.json({ error: 'applicationId zorunludur.' }, { status: 400 });
        const result = await reviewApplication(
          payload.applicationId,
          'APPROVED',
          undefined,
          actor.userId
        );
        if (result.success) {
          await recordAuditEvent({ eventType: 'ADMIN_APPLICATION_REVIEWED', userId: actor.userId, profileId: adminActorProfileId, metadata: { targetType: 'corporate_application', targetId: payload.applicationId, status: 'APPROVED' } });
          try {
            const { revalidatePath } = await import('next/cache');
            revalidatePath('/');
            revalidatePath('/arac');
            revalidatePath('/mulk');
            revalidatePath('/hesabim');
            revalidatePath('/hesabim/kurumsal');
            revalidatePath('/yonetim');
          } catch {}
        }
        return safeMutationResult(result, 'Kurumsal başvuru onaylanamadı.');
      }

      // Application Review: Reject (requires reason)
      case 'rejectApplication': {
        if (!payload.applicationId || typeof payload.applicationId !== 'string') return NextResponse.json({ error: 'applicationId zorunludur.' }, { status: 400 });
        if (typeof payload.rejectionReason !== 'string' || !payload.rejectionReason.trim()) {
          return NextResponse.json({ error: 'Red gerekçesi zorunludur.' }, { status: 400 });
        }
        if (payload.rejectionReason.trim().length > 500) return NextResponse.json({ error: 'Red gerekçesi en fazla 500 karakter olabilir.' }, { status: 400 });
        const result = await reviewApplication(
          payload.applicationId,
          'REJECTED',
          payload.rejectionReason.trim(),
          actor.userId
        );
        if (result.success) await recordAuditEvent({ eventType: 'ADMIN_APPLICATION_REVIEWED', userId: actor.userId, profileId: adminActorProfileId, metadata: { targetType: 'corporate_application', targetId: payload.applicationId, status: 'REJECTED', reason: payload.rejectionReason.trim() } });
        return safeMutationResult(result, 'Kurumsal başvuru reddedilemedi.');
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
        return safeMutationResult(result, 'Kurumsal mağaza askıya alınamadı.');
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
        return safeMutationResult(result, 'Kurumsal mağaza yeniden aktifleştirilemedi.');
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
        return safeMutationResult(result, 'Kurumsal mağaza silinemedi.');
      }

      case 'manuallyActivateCorporateSubscription': {
        if (!payload.dealerId || typeof payload.dealerId !== 'string') {
          return NextResponse.json({ error: 'dealerId zorunludur.' }, { status: 400 });
        }
        const result = await manuallyActivateCorporateSubscription(payload.dealerId, adminActorProfileId);
        if (result.success && result.dealer) {
          await recordAuditEvent({
            eventType: 'CORPORATE_SUBSCRIPTION_MANUAL_ACTIVATION',
            userId: actor.userId,
            profileId: adminActorProfileId,
            metadata: {
              targetType: 'corporate_profile',
              targetId: result.dealer.id,
              ownerProfileId: result.dealer.owner_profile_id || result.dealer.profile_id,
              previousSubscriptionStatus: result.previousStatus,
              newSubscriptionStatus: result.dealer.subscription_status,
              activatedAt: result.activatedAt,
              subscriptionExpiresAt: result.dealer.subscription_expires_at,
              source: 'ADMIN_GRANT',
            },
          });
          try {
            const { revalidatePath } = await import('next/cache');
            revalidatePath('/hesabim');
            revalidatePath('/hesabim/kurumsal');
            revalidatePath('/yonetim');
            revalidatePath(`/premium/${result.dealer.id}`);
          } catch {}
        }
        return safeMutationResult(result, 'Kurumsal üyelik manuel olarak aktifleştirilemedi.');
      }

      case 'updateDealer': {
        if (!['APPROVED', 'REJECTED'].includes(payload.status)) return NextResponse.json({ error: 'Geçersiz mağaza durumu.' }, { status: 400 });
        const success = await updateDealerStatus(
          payload.dealerId,
          payload.status,
          payload.rejectionReason
        );
        return NextResponse.json({ success });
      }

      case 'updateTicket': {
        const allowedStatuses: TicketStatus[] = ['OPEN', 'ANSWERED', 'CLOSED'];
        if (!allowedStatuses.includes(payload.status)) return NextResponse.json({ error: 'Geçersiz ticket durumu.' }, { status: 400 });
        const success = await updateTicketStatus(
          payload.ticketId,
          payload.status
        );
        if (success) await recordAuditEvent({ eventType: 'ADMIN_TICKET_STATUS_CHANGED', userId: actor.userId, profileId: adminActorProfileId, metadata: { targetType: 'ticket', targetId: payload.ticketId, status: payload.status } });
        return NextResponse.json({ success });
      }

      case 'adminReplyTicket': {
        if (!payload.message?.trim()) return NextResponse.json({ error: 'Mesaj boş olamaz.' }, { status: 400 });
        const adminProfile = await getUserRepository().getProfileById(adminActorProfileId);
        if (!adminProfile) return NextResponse.json({ error: 'Aktif yönetici karakteri bulunamadı.' }, { status: 403 });
        const result = await addTicketMessage({
          ticketId: payload.ticketId,
          senderRole: 'ADMIN',
          // Keep the canonical actor name internally; API presentation masks ADMIN authors server-side.
          senderName: adminProfile.full_name,
          message: payload.message.trim(),
        });
        if (result.success) await recordAuditEvent({ eventType: 'ADMIN_TICKET_REPLIED', userId: actor.userId, profileId: adminActorProfileId, metadata: { targetType: 'ticket', targetId: payload.ticketId } });
        return safeMutationResult(result, 'Ticket yanıtı gönderilemedi.');
      }

      default:
        return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    );
  }
}

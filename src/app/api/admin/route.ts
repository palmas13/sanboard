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
import { getAllDealers, updateDealerStatus } from '@/lib/db/dealers';
import { getAllTicketsForAdmin, updateTicketStatus, addTicketMessage } from '@/lib/db/tickets';
import { db } from '@/lib/db/store';

function checkAdminAccess(req: NextRequest): boolean {
  // Check cookie or header or profileId/userId in db
  const roleCookie = req.cookies.get('sanboard_role')?.value;
  if (roleCookie === 'ADMIN') return true;

  const roleHeader = req.headers.get('x-sanboard-role');
  if (roleHeader === 'ADMIN') return true;

  const userId = req.cookies.get('sanboard_user_id')?.value;
  if (userId) {
    const user = db.users.find((u) => u.id === userId);
    if (user && user.role === 'ADMIN') return true;
  }

  const profileId = req.cookies.get('sanboard_profile_id')?.value;
  if (profileId) {
    const profile = db.profiles.find((p) => p.id === profileId);
    if (profile) {
      const user = db.users.find((u) => u.id === profile.user_id);
      if (user && user.role === 'ADMIN') return true;
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!checkAdminAccess(req)) {
    return NextResponse.json(
      { error: 'Yetkisiz erişim. Bu alana yalnızca Sanboard yöneticileri erişebilir.' },
      { status: 403 }
    );
  }

  try {
    const [stats, listings, users, reports, dealers, tickets] = await Promise.all([
      getAdminStats(),
      getAllListingsForAdmin(),
      getAllUsersForAdmin(),
      getReportsForAdmin(),
      getAllDealers(),
      getAllTicketsForAdmin(),
    ]);

    const standardPackage = db.packages.find((p) => p.code === 'STANDARD_7_DAY');

    return NextResponse.json({
      stats,
      listings,
      users,
      reports,
      dealers,
      tickets,
      payments: db.payments,
      packagePrice: standardPackage?.price || 2000,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Admin verileri getirilemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminAccess(req)) {
    return NextResponse.json(
      { error: 'Yetkisiz erişim. Bu alana yalnızca Sanboard yöneticileri erişebilir.' },
      { status: 403 }
    );
  }

  try {
    const { action, payload } = await req.json();

    switch (action) {
      case 'delist': {
        const success = await adminDelistListing(payload.listingId);
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

      case 'updateDealer': {
        const success = await updateDealerStatus(
          payload.dealerId,
          payload.status
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

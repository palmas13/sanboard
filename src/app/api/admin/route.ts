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

import { getServerSession } from '@/lib/auth/session';

async function checkAdminAccess(req: NextRequest): Promise<boolean> {
  // Authenticate strictly via cryptographically signed session
  const session = await getServerSession(req);
  if (session && session.role === 'ADMIN') return true;

  // Internal secret header for backend service calls
  const secretHeader = req.headers.get('x-sanboard-secret');
  if (secretHeader && process.env.SUPABASE_SECRET_KEY && secretHeader === process.env.SUPABASE_SECRET_KEY) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!(await checkAdminAccess(req))) {
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
      dealers,
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

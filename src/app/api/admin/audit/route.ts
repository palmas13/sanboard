import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getPersistedAuditRecords } from '@/lib/audit';

/**
 * GET /api/admin/audit
 * Retrieves persisted audit logs.
 * Strictly protected: Requires signed Sanboard HMAC session with role === 'ADMIN'.
 * Supabase service_role bypasses RLS, so server-side application authorization
 * is the primary gatekeeper.
 */
export async function GET(req: NextRequest) {
  // 1. Verify signed server session and ADMIN role
  const session = await getServerSession(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Yetkisiz erişim. Denetim kayıtlarını yalnızca Sanboard yöneticileri görüntüleyebilir.' },
      { status: 403 }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 500) : 100;

  try {
    const logs = await getPersistedAuditRecords(limit);
    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Denetim kayıtları alınamadı.' },
      { status: 500 }
    );
  }
}

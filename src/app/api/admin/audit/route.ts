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
  if (!session?.userId) {
    return NextResponse.json(
      { error: 'Yetkisiz erişim. Lütfen giriş yapın.' },
      { status: 401 }
    );
  }

  let isDbAdmin = false;
  if (process.env.DATA_STORE === 'supabase') {
    try {
      const { getSupabaseAdminClient } = await import('@/lib/db/supabase-client');
      const client = getSupabaseAdminClient();
      if (client) {
        const { data: dbUser } = await client
          .from('users')
          .select('role, status')
          .eq('id', session.userId)
          .maybeSingle();
        isDbAdmin = Boolean(dbUser && dbUser.role === 'ADMIN' && dbUser.status === 'ACTIVE');
      }
    } catch {
      // Fallback
    }
  } else {
    const { db } = await import('@/lib/db/store');
    const user = db.users.find((u) => u.id === session.userId);
    isDbAdmin = Boolean(user && user.role === 'ADMIN' && user.status === 'ACTIVE');
  }

  if (!isDbAdmin) {
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

import { NextRequest, NextResponse } from 'next/server';
import { getPersistedAuditRecords } from '@/lib/audit';
import { resolveActiveAdmin } from '@/lib/auth/active-profile';

/**
 * GET /api/admin/audit
 * Retrieves persisted audit logs.
 * Strictly protected: Requires signed Sanboard HMAC session with role === 'ADMIN'.
 * Supabase service_role bypasses RLS, so server-side application authorization
 * is the primary gatekeeper.
 */
export async function GET(req: NextRequest) {
  const actor = await resolveActiveAdmin(req);
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

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

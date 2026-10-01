import { isAuthorizedWorkerRequest, unauthorizedWorkerResponse } from '@/lib/internal/worker-auth';
import { runOrphanScan } from '../../../../../scripts/media-cleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedWorkerRequest(request)) return unauthorizedWorkerResponse();
  try {
    const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true';
    const report = await runOrphanScan({ execute: !dryRun, graceHours: 24, quiet: true, maxObjects: 1000 });
    if (report.failedCount > 0) {
      return Response.json({ success: false, error: 'Orphan reconciliation partially failed.', report }, {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return Response.json({ success: true, report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Orphan reconciliation failed:', error instanceof Error ? error.message : error);
    return Response.json({ success: false, error: 'Orphan reconciliation failed.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
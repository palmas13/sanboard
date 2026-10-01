import { isAuthorizedWorkerRequest, unauthorizedWorkerResponse } from '@/lib/internal/worker-auth';
import { runMediaCleanupWorker } from '@/lib/lifecycle/media-cleanup-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedWorkerRequest(request)) return unauthorizedWorkerResponse();
  try {
    return Response.json({ success: true, counts: await runMediaCleanupWorker() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Media cleanup worker failed:', error instanceof Error ? error.message : error);
    return Response.json({ success: false, error: 'Media cleanup failed.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

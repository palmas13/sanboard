import { isAuthorizedWorkerRequest, unauthorizedWorkerResponse } from '@/lib/internal/worker-auth';
import { runCorporatePurgeWorker } from '@/lib/lifecycle/corporate-purge-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedWorkerRequest(request)) return unauthorizedWorkerResponse();
  try {
    return Response.json({ success: true, counts: await runCorporatePurgeWorker() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Corporate purge worker failed:', error instanceof Error ? error.message : error);
    return Response.json({ success: false, error: 'Corporate purge failed.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
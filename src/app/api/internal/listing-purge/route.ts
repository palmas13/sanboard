import { isAuthorizedWorkerRequest, unauthorizedWorkerResponse } from '@/lib/internal/worker-auth';
import { runListingPurgeWorker } from '@/lib/lifecycle/listing-purge-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedWorkerRequest(request)) return unauthorizedWorkerResponse();
  try {
    return Response.json({ success: true, counts: await runListingPurgeWorker() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Listing purge worker failed:', error instanceof Error ? error.message : error);
    return Response.json({ success: false, error: 'Listing purge failed.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

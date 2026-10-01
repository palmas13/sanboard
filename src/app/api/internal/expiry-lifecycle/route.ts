import { NextRequest, NextResponse } from 'next/server';
import { runExpiryLifecycle } from '@/lib/lifecycle/expiry';
import { isAuthorizedWorkerRequest } from '@/lib/internal/worker-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, ...(await runExpiryLifecycle()) });
  } catch (error) {
    console.error('Expiry lifecycle route failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Lifecycle operation failed.' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runExpiryLifecycle } from '@/lib/lifecycle/expiry';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.LIFECYCLE_CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || secret.length < 32 || !authorization?.startsWith('Bearer ')) return false;
  const supplied = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(secret, 'utf8');
  const suppliedBuffer = Buffer.from(supplied, 'utf8');
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, ...(await runExpiryLifecycle()) });
  } catch (error) {
    console.error('Expiry lifecycle route failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Lifecycle operation failed.' }, { status: 500 });
  }
}
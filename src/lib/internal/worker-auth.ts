import { timingSafeEqual } from 'node:crypto';

const MIN_SECRET_LENGTH = 32;

/** Fail-closed authentication shared by internal scheduler endpoints. */
export function isAuthorizedWorkerRequest(request: Request): boolean {
  // Vercel cron uses CRON_SECRET automatically; the legacy lifecycle name is
  // supported so all internal workers can share one hardened helper.
  const secret = process.env.CRON_SECRET || process.env.LIFECYCLE_CRON_SECRET;
  const header = request.headers.get('authorization');
  if (!secret || secret.length < MIN_SECRET_LENGTH || !header?.startsWith('Bearer ')) return false;

  const expected = Buffer.from(secret, 'utf8');
  const supplied = Buffer.from(header.slice(7), 'utf8');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function unauthorizedWorkerResponse(): Response {
  return Response.json({ success: false, error: 'Unauthorized.' }, {
    status: 401,
    headers: { 'Cache-Control': 'no-store' },
  });
}

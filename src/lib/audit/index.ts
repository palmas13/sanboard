import { getAuditRepository, AuditRecord } from '@/lib/db/repositories';

export type AuditEventType =
  | 'AUTH_OAUTH_STARTED'
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'CHARACTER_SELECTED'
  | 'CHARACTER_SWITCHED'
  | 'AUTH_LOGOUT'
  | 'PAYMENT_SUCCESS'
  | 'CREDIT_PURCHASED'
  | 'LISTING_PUBLISHED'
  | 'PROFILE_CREATED'
  | 'CORPORATE_STORE_SUSPENDED'
  | 'CORPORATE_STORE_REACTIVATED'
  | 'CORPORATE_STORE_DELETED'
  | 'ADMIN_LISTING_DELISTED'
  | 'ADMIN_ACCOUNT_STATUS_CHANGED'
  | 'ADMIN_PACKAGE_PRICE_CHANGED'
  | 'ADMIN_REPORT_STATUS_CHANGED'
  | 'ADMIN_APPLICATION_REVIEWED'
  | 'ADMIN_TICKET_STATUS_CHANGED'
  | 'ADMIN_TICKET_REPLIED'
  | 'ADMIN_FAVICON_UPDATED';

export interface AuditEventPayload {
  eventType: AuditEventType;
  userId?: string | null;
  profileId?: string | null;
  metadata?: Record<string, any>;
  timestamp?: string;
}

const REDACTED_KEYS = new Set([
  'access_token',
  'token',
  'authorization_code',
  'code',
  'client_secret',
  'secret',
  'authorization',
  'password',
  'key',
  'refresh_token',
]);

/**
 * Sanitizes audit metadata strictly ensuring credentials, tokens, codes, and secrets
 * are never recorded in audit logs.
 */
export function sanitizeAuditMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') return {};
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (
      REDACTED_KEYS.has(lowerKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('code')
    ) {
      continue; // Strictly omit secret and token fields from audit metadata
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Records an audit event using the active repository (SupabaseAuditRepository in production/staging).
 * Handled safely with sanitized metadata and non-blocking error catching.
 */
export async function recordAuditEvent(payload: AuditEventPayload): Promise<void> {
  const timestamp = payload.timestamp || new Date().toISOString();
  const safeMeta = sanitizeAuditMetadata(payload.metadata);

  try {
    const repo = getAuditRepository();
    await repo.recordEvent({
      eventType: payload.eventType,
      userId: payload.userId,
      profileId: payload.profileId,
      metadata: safeMeta,
      timestamp,
    });
  } catch (err: any) {
    // Non-blocking so audit failures never break the core transaction/auth flow
    console.warn(`[AuditLog Warning] Could not record audit event: ${err?.message || err}`);
  }
}

/**
 * Retrieves persisted audit records (used by admin panel / audit reporting).
 */
export async function getPersistedAuditRecords(limit: number = 100): Promise<AuditRecord[]> {
  try {
    const repo = getAuditRepository();
    return await repo.getAuditLogs(limit);
  } catch {
    return [];
  }
}

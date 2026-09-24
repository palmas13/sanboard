import { IAuditRepository, AuditRecord } from '../types';
import { db } from '../../store';

export class MemoryAuditRepository implements IAuditRepository {
  async recordEvent(event: {
    eventType: string;
    userId?: string | null;
    profileId?: string | null;
    metadata?: Record<string, any>;
    timestamp?: string;
  }): Promise<void> {
    const entry: AuditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      event_type: event.eventType,
      user_id: event.userId || null,
      profile_id: event.profileId || null,
      metadata: event.metadata || {},
      created_at: event.timestamp || new Date().toISOString(),
    };
    db.auditLogs.unshift(entry);
  }

  async getAuditLogs(limit: number = 100): Promise<AuditRecord[]> {
    return db.auditLogs.slice(0, limit);
  }
}

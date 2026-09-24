import { IAuditRepository, AuditRecord } from '../types';
import { getSupabaseAdminClient } from '../../supabase-client';

export class SupabaseAuditRepository implements IAuditRepository {
  private getClient() {
    const admin = getSupabaseAdminClient();
    if (!admin) {
      throw new Error(
        'Supabase admin client is not initialized for audit logging. SUPABASE_SECRET_KEY is required.'
      );
    }
    return admin;
  }

  async recordEvent(event: {
    eventType: string;
    userId?: string | null;
    profileId?: string | null;
    metadata?: Record<string, any>;
    timestamp?: string;
  }): Promise<void> {
    try {
      const client = this.getClient();
      const { error } = await client.from('audit_logs').insert({
        event_type: event.eventType,
        user_id: event.userId || null,
        profile_id: event.profileId || null,
        metadata: event.metadata || {},
        created_at: event.timestamp || new Date().toISOString(),
      });

      if (error) {
        console.warn(`[AuditLog Supabase Warning] Could not persist audit record: ${error.message}`);
      }
    } catch (err: any) {
      // Non-blocking so audit failures never break the core transaction/auth flow
      console.warn(`[AuditLog Supabase Warning] Non-blocking audit error: ${err?.message || err}`);
    }
  }

  async getAuditLogs(limit: number = 100): Promise<AuditRecord[]> {
    try {
      const client = this.getClient();
      const { data, error } = await client
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn(`[AuditLog Supabase Warning] Error retrieving audit logs: ${error.message}`);
        return [];
      }
      return (data || []) as AuditRecord[];
    } catch {
      return [];
    }
  }
}

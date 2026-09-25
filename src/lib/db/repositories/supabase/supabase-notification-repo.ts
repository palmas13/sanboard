import { INotificationRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { Notification, NotificationType } from '@/types';
import { resolveUserId, resolveProfileId, isUuid } from '../../id-mapper';

export class SupabaseNotificationRepository implements INotificationRepository {
  private getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        'Supabase client is not initialized. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.'
      );
    }
    return client;
  }

  private getAdminClient() {
    const admin = getSupabaseAdminClient();
    if (admin) return admin;
    return this.getClient();
  }

  async getUserNotifications(profileId: string): Promise<Notification[]> {
    const client = this.getAdminClient();
    const safeId = resolveProfileId(profileId);
    if (!isUuid(safeId)) return [];

    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('recipient_profile_id', safeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching notifications: ${error.message}`);
    }

    const mapped = (data || []).map((n: any) => ({
      ...n,
      is_read: Boolean(n.read_at),
      link: n.entity_type === 'ticket' && n.entity_id
        ? `/hesabim/destek/${n.entity_id}`
        : n.entity_type === 'listing' && n.entity_id
        ? `/ilan/${n.entity_id}`
        : undefined,
    }));

    return mapped as Notification[];
  }

  async getUnreadCount(profileId: string): Promise<number> {
    const client = this.getAdminClient();
    const safeId = resolveProfileId(profileId);
    if (!isUuid(safeId)) return 0;

    const { count, error } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_profile_id', safeId)
      .is('read_at', null);

    if (error) {
      throw new Error(`Supabase error fetching unread notification count: ${error.message}`);
    }

    return count || 0;
  }

  async markAsRead(profileId: string, notificationId: string): Promise<{ success: boolean; notification?: Notification; error?: string }> {
    const client = this.getAdminClient();
    const safeId = resolveProfileId(profileId);

    const { data, error } = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_profile_id', safeId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const notif = data ? {
      ...data,
      is_read: Boolean(data.read_at),
      link: data.entity_type === 'ticket' && data.entity_id
        ? `/hesabim/destek/${data.entity_id}`
        : data.entity_type === 'listing' && data.entity_id
        ? `/ilan/${data.entity_id}`
        : undefined,
    } : undefined;

    return { success: true, notification: notif as Notification };
  }

  async markAllAsRead(profileId: string): Promise<{ success: boolean; count: number }> {
    const client = this.getAdminClient();
    const safeId = resolveProfileId(profileId);

    const { data, error } = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_profile_id', safeId)
      .is('read_at', null)
      .select('id');

    if (error) {
      return { success: false, count: 0 };
    }

    return { success: true, count: data?.length || 0 };
  }

  async createNotification(params: {
    recipient_profile_id?: string;
    user_id?: string;
    type: NotificationType;
    title: string;
    message: string;
    entity_type?: 'listing' | 'ticket' | 'application' | 'system';
    entity_id?: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    const client = this.getAdminClient();

    const insertPayload: any = {
      type: params.type,
      title: params.title,
      message: params.message,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      metadata: params.metadata,
      created_at: new Date().toISOString(),
    };

    if (params.recipient_profile_id) {
      const safeRecipient = resolveProfileId(params.recipient_profile_id);
      if (isUuid(safeRecipient)) insertPayload.recipient_profile_id = safeRecipient;
    }
    if (params.user_id) {
      const safeUid = resolveUserId(params.user_id);
      if (isUuid(safeUid)) insertPayload.user_id = safeUid;
    }

    const { data, error } = await client
      .from('notifications')
      .insert(insertPayload)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Supabase error creating notification: ${error?.message}`);
    }

    return data as Notification;
  }
}

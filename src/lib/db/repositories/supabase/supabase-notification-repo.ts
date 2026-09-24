import { INotificationRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { Notification, NotificationType } from '@/types';
import { resolveUserId, isUuid } from '../../id-mapper';

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

  async getUserNotifications(userId: string): Promise<Notification[]> {
    const client = this.getClient();
    const safeUserId = resolveUserId(userId);
    if (!isUuid(safeUserId)) return [];

    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', safeUserId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching notifications: ${error.message}`);
    }

    return (data || []) as Notification[];
  }

  async getUnreadCount(userId: string): Promise<number> {
    const client = this.getClient();
    const safeUserId = resolveUserId(userId);
    if (!isUuid(safeUserId)) return 0;

    const { count, error } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', safeUserId)
      .is('read_at', null);

    if (error) {
      throw new Error(`Supabase error fetching unread notification count: ${error.message}`);
    }

    return count || 0;
  }

  async markAsRead(userId: string, notificationId: string): Promise<{ success: boolean; notification?: Notification; error?: string }> {
    const client = this.getAdminClient();

    const { data, error } = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, notification: data as Notification };
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; count: number }> {
    const client = this.getAdminClient();

    const { data, error } = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
      .select('id');

    if (error) {
      return { success: false, count: 0 };
    }

    return { success: true, count: data?.length || 0 };
  }

  async createNotification(params: {
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    entity_type?: 'listing' | 'ticket' | 'application' | 'system';
    entity_id?: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    const client = this.getAdminClient();

    const { data, error } = await client
      .from('notifications')
      .insert({
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        message: params.message,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        metadata: params.metadata,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Supabase error creating notification: ${error?.message}`);
    }

    return data as Notification;
  }
}

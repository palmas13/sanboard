import { db } from './store';
import { Notification, NotificationType } from '@/types';

function ensureNotifications() {
  if (!db.notifications) {
    db.notifications = [];
  }
}

/**
 * Get all notifications for a specific character profile, sorted newest first.
 */
export async function getUserNotifications(profileId: string): Promise<Notification[]> {
  ensureNotifications();
  return db.notifications
    .filter((n) => n.recipient_profile_id === profileId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((n) => ({
      ...n,
      is_read: Boolean(n.read_at),
      link: n.entity_type === 'ticket' && n.entity_id
        ? `/hesabim/destek/${n.entity_id}`
        : n.entity_type === 'listing' && n.entity_id
        ? `/ilan/${n.entity_id}`
        : undefined,
    }));
}

/**
 * Get count of unread notifications for a specific character profile.
 */
export async function getUnreadNotificationCount(profileId: string): Promise<number> {
  ensureNotifications();
  return db.notifications.filter(
    (n) => n.recipient_profile_id === profileId && !n.read_at
  ).length;
}

/**
 * Mark a single notification as read with character ownership validation.
 */
export async function markNotificationAsRead(
  profileId: string,
  notificationId: string
): Promise<{ success: boolean; notification?: Notification; error?: string }> {
  ensureNotifications();
  const notif = db.notifications.find((n) => n.id === notificationId);

  if (!notif) {
    return { success: false, error: 'Bildirim bulunamadı.' };
  }

  const isOwner = notif.recipient_profile_id === profileId;
  if (!isOwner) {
    return { success: false, error: 'Bu bildirimi güncelleme yetkiniz yok.' };
  }

  if (!notif.read_at) {
    notif.read_at = new Date().toISOString();
    notif.is_read = true;
  }

  return {
    success: true,
    notification: {
      ...notif,
      is_read: true,
      link: notif.entity_type === 'ticket' && notif.entity_id
        ? `/hesabim/destek/${notif.entity_id}`
        : notif.entity_type === 'listing' && notif.entity_id
        ? `/ilan/${notif.entity_id}`
        : undefined,
    },
  };
}

/**
 * Mark all notifications as read for a specific character profile.
 */
export async function markAllNotificationsAsRead(profileId: string): Promise<{ success: boolean; count: number }> {
  ensureNotifications();
  const now = new Date().toISOString();
  let updatedCount = 0;

  db.notifications.forEach((n) => {
    const isOwner = n.recipient_profile_id === profileId;
    if (isOwner && !n.read_at) {
      n.read_at = now;
      updatedCount++;
    }
  });

  return { success: true, count: updatedCount };
}

/**
 * Create a new notification (strictly character-scoped).
 */
export async function createNotification(params: {
  recipient_profile_id?: string;
  user_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: 'listing' | 'ticket' | 'application' | 'system';
  entity_id?: string;
  metadata?: Record<string, any>;
}): Promise<Notification> {
  ensureNotifications();
  const newNotif: Notification = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipient_profile_id: params.recipient_profile_id,
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    message: params.message,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    metadata: params.metadata,
    read_at: null,
    created_at: new Date().toISOString(),
  };

  db.notifications.unshift(newNotif);
  return newNotif;
}

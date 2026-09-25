import { INotificationRepository } from '../types';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
} from '../../notifications';
import { NotificationType } from '@/types';

export class MemoryNotificationRepository implements INotificationRepository {
  async getUserNotifications(profileIdOrUserId: string) {
    return getUserNotifications(profileIdOrUserId);
  }

  async getUnreadCount(profileIdOrUserId: string) {
    return getUnreadNotificationCount(profileIdOrUserId);
  }

  async markAsRead(profileIdOrUserId: string, notificationId: string) {
    return markNotificationAsRead(profileIdOrUserId, notificationId);
  }

  async markAllAsRead(profileIdOrUserId: string) {
    return markAllNotificationsAsRead(profileIdOrUserId);
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
  }) {
    return createNotification(params);
  }
}

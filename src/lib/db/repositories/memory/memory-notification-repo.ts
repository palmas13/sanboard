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
  async getUserNotifications(userId: string) {
    return getUserNotifications(userId);
  }

  async getUnreadCount(userId: string) {
    return getUnreadNotificationCount(userId);
  }

  async markAsRead(userId: string, notificationId: string) {
    return markNotificationAsRead(userId, notificationId);
  }

  async markAllAsRead(userId: string) {
    return markAllNotificationsAsRead(userId);
  }

  async createNotification(params: {
    user_id: string;
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

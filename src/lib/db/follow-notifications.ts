import { getNotificationRepository } from '@/lib/db/repositories';

interface NewFollowerNotification {
  recipientProfileId: string;
  followerName: string;
  corporateProfileId: string;
  recipientUserId?: string;
}

type NotificationCreator = ReturnType<typeof getNotificationRepository>['createNotification'];

/** A follow relation is authoritative; its notification is best-effort. */
export async function notifyNewFollowerBestEffort(
  notification: NewFollowerNotification,
  createNotification?: NotificationCreator
): Promise<void> {
  try {
    const create = createNotification
      ?? getNotificationRepository().createNotification.bind(getNotificationRepository());
    await create({
      recipient_profile_id: notification.recipientProfileId,
      user_id: notification.recipientUserId,
      type: 'NEW_FOLLOWER',
      title: 'Yeni Takipçi',
      message: `${notification.followerName} mağazanızı takip etmeye başladı.`,
      entity_type: 'application',
      entity_id: notification.corporateProfileId,
    });
  } catch (error) {
    console.error('Failed to dispatch new follower notification:', error);
  }
}
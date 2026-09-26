import { NextRequest, NextResponse } from 'next/server';
import { getNotificationRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.error }, { status: actor.status });
    }
    const activeProfileId = actor.profileId;

    const repo = getNotificationRepository();
    if (req.nextUrl.searchParams.get('countOnly') === '1') {
      const unreadCount = await repo.getUnreadCount(activeProfileId);
      return NextResponse.json({ unreadCount });
    }

    const [notifications, unreadCount] = await Promise.all([
      repo.getUserNotifications(activeProfileId),
      repo.getUnreadCount(activeProfileId),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Bildirimler getirilemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.error }, { status: actor.status });
    }
    const activeProfileId = actor.profileId;

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const notificationId = body.notificationId;

    const repo = getNotificationRepository();

    if (action === 'markRead' || action === 'mark_as_read') {
      if (!notificationId) {
        return NextResponse.json(
          { error: 'notificationId zorunludur.' },
          { status: 400 }
        );
      }

      const res = await repo.markAsRead(activeProfileId, notificationId);
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 403 });
      }

      const unreadCount = await repo.getUnreadCount(activeProfileId);
      return NextResponse.json({ success: true, notification: res.notification, unreadCount });
    }

    if (action === 'markAllRead' || action === 'mark_all_read') {
      const res = await repo.markAllAsRead(activeProfileId);
      return NextResponse.json({ success: true, count: res.count, unreadCount: 0 });
    }

    return NextResponse.json({ error: 'Geçersiz aksiyon.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    );
  }
}

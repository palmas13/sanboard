import { NextRequest, NextResponse } from 'next/server';
import { getNotificationRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { ServerTiming } from '@/lib/performance/server-timing';

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) {
      return timing.respond(NextResponse.json({ error: actor.error }, { status: actor.status }));
    }
    const activeProfileId = actor.profileId;

    const repo = getNotificationRepository();
    if (req.nextUrl.searchParams.get('countOnly') === '1') {
      const unreadCount = await timing.measure('notifications', () => repo.getUnreadCount(activeProfileId));
      return timing.respond(NextResponse.json({ unreadCount }));
    }

    const offset = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('limit') || '5', 10) || 5));
    const [notifications, unreadCount, totalCount] = await timing.measure('notifications', () => Promise.all([
      repo.getUserNotifications(activeProfileId, { offset, limit }),
      repo.getUnreadCount(activeProfileId),
      repo.getNotificationCount(activeProfileId),
    ]));

    return timing.respond(NextResponse.json({
      notifications,
      unreadCount,
      totalCount,
      hasMore: offset + notifications.length < totalCount,
      nextOffset: offset + notifications.length,
    }));
  } catch (error: any) {
    return timing.respond(NextResponse.json(
      { error: error?.message || 'Bildirimler getirilemedi.' },
      { status: 500 }
    ));
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const body = await req.json().catch(() => ({}));
    const ids = typeof body.notificationId === 'string' && body.notificationId.length > 0
      ? [body.notificationId]
      : body.notificationIds === undefined
      ? undefined
      : Array.isArray(body.notificationIds)
      ? body.notificationIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (ids && ids.length > 100) return NextResponse.json({ error: 'En fazla 100 bildirim silinebilir.' }, { status: 400 });
    const repo = getNotificationRepository();
    const result = await repo.deleteNotifications(actor.profileId, ids);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
    const [unreadCount, totalCount] = await Promise.all([
      repo.getUnreadCount(actor.profileId), repo.getNotificationCount(actor.profileId),
    ]);
    return NextResponse.json({ success: true, count: result.count, unreadCount, totalCount });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Bildirimler silinemedi.' }, { status: 500 });
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

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationRepository } from '@/lib/db/repositories';
import { getServerSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    const isMock = process.env.USE_MOCK_GTAWORLD_AUTH !== 'false';
    const userId = session?.userId || (isMock ? '22222222-2222-2222-2222-222222222222' : null);

    if (!userId) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın.' },
        { status: 401 }
      );
    }

    // Security: If query param userId is passed, verify it matches authenticated session user
    const queryUserId = req.nextUrl.searchParams.get('userId');
    if (queryUserId && queryUserId !== userId && session?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Başka bir kullanıcının bildirimlerine erişim yetkiniz yok.' },
        { status: 403 }
      );
    }

    const repo = getNotificationRepository();
    const [notifications, unreadCount] = await Promise.all([
      repo.getUserNotifications(userId),
      repo.getUnreadCount(userId),
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
    const session = await getServerSession(req);
    const isMock = process.env.USE_MOCK_GTAWORLD_AUTH !== 'false';
    const userId = session?.userId || (isMock ? '22222222-2222-2222-2222-222222222222' : null);

    if (!userId) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın.' },
        { status: 401 }
      );
    }

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

      const res = await repo.markAsRead(userId, notificationId);
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 403 });
      }

      const unreadCount = await repo.getUnreadCount(userId);
      return NextResponse.json({ success: true, notification: res.notification, unreadCount });
    }

    if (action === 'markAllRead' || action === 'mark_all_read') {
      const res = await repo.markAllAsRead(userId);
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

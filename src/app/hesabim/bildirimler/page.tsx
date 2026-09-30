'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Bell,
  ArrowDownCircle,
  LifeBuoy,
  Sparkles,
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  Calendar,
  Trash2,
} from 'lucide-react';
import { Notification } from '@/types';
import { formatDateTime } from '@/lib/utils/format';
import { openOfferThread } from '@/components/offers/OfferCenter';

export default function HesabimBildirimlerPage() {
  const router = useRouter();
  const { user, currentProfile, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!currentProfile?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?offset=0&limit=5');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setTotalCount(data.totalCount || 0);
      setHasMore(Boolean(data.hasMore));
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [currentProfile?.id]);

  useEffect(() => {
    if (isAuthenticated && currentProfile?.id) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setTotalCount(0);
      setHasMore(false);
      setLoading(false);
    }
  }, [isAuthenticated, currentProfile?.id, fetchNotifications]);

  const handleMarkAsRead = async (notifId: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markRead',
          userId: user.id,
          notificationId: notifId,
        }),
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markAllRead',
          userId: user.id,
        }),
      });

      if (res.ok) {
        const now = new Date().toISOString();
        setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
        setUnreadCount(0);
      }
    } catch {
      // Ignore
    } finally {
      setActionLoading(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      // The offset is the current retained row count, so pagination remains correct after deletes.
      const res = await fetch(`/api/notifications?offset=${notifications.length}&limit=5`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications((prev) => [...prev, ...(data.notifications || []).filter((n: Notification) => !prev.some((p) => p.id === n.id))]);
      setUnreadCount(data.unreadCount || 0);
      setTotalCount(data.totalCount || 0);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async (ids?: string[]) => {
    const previous = notifications;
    const previousUnread = unreadCount;
    const removed = ids ? notifications.filter((n) => ids.includes(n.id)) : notifications;
    setNotifications((current) => ids ? current.filter((n) => !ids.includes(n.id)) : []);
    setUnreadCount((count) => Math.max(0, count - removed.filter((n) => !n.read_at).length));
    setTotalCount((count) => ids ? Math.max(0, count - removed.length) : 0);
    if (!ids) setHasMore(false);
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { notificationIds: ids } : {}),
      });
      if (!res.ok) throw new Error('delete failed');
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
      setTotalCount(data.totalCount || 0);
      setHasMore(notifications.length - removed.length < (data.totalCount || 0));
    } catch {
      setNotifications(previous);
      setUnreadCount(previousUnread);
      setTotalCount((count) => Math.max(count, previous.length));
      setHasMore(previous.length < totalCount);
    }
  };

  const handleItemClick = (notif: Notification) => {
    if (!notif.read_at && user) {
      handleMarkAsRead(notif.id);
    }

    if (notif.entity_type === 'offer' && (notif.metadata?.offerThreadId || notif.entity_id)) {
      openOfferThread(String(notif.metadata?.offerThreadId || notif.entity_id));
    } else if (notif.entity_type === 'listing' && notif.entity_id) {
      router.push(`/ilan/${notif.entity_id}`);
    } else if (notif.entity_type === 'ticket' && notif.entity_id) {
      router.push(`/hesabim/destek/${notif.entity_id}`);
    } else if (notif.entity_type === 'application') {
      router.push('/hesabim/kurumsal');
    }
  };

  const filteredNotifications =
    activeTab === 'UNREAD'
      ? notifications.filter((n) => !n.read_at)
      : notifications;

  const getIcon = (type: string) => {
    switch (type) {
      case 'LISTING_PRICE_DROP':
      case 'LISTING_PRICE_CHANGE':
        return <ArrowDownCircle className="w-5 h-5 text-[#FF8A1F]" />;
      case 'SUPPORT_REPLY':
        return <LifeBuoy className="w-5 h-5 text-emerald-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-[#FF8A1F]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="surface-card p-5 sm:p-6 rounded-2xl border border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--text-main)]">Bildirimler</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FF8A1F] text-black">
                {unreadCount} Okunmamış
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            İlanlarınız, favorileriniz ve destek talepleriniz hakkındaki güncellemeler.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-[var(--bg-surface-secondary)] p-1 border border-[var(--border-app)]">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-[var(--bg-surface)] text-[#FF8A1F] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Tümü ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('UNREAD')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'UNREAD'
                  ? 'bg-[var(--bg-surface)] text-[#FF8A1F] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Okunmamış ({unreadCount})
            </button>
          </div>

          {totalCount > 0 && (
            <button type="button" onClick={() => handleDelete()} className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Tümünü Temizle
            </button>
          )}

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={actionLoading}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 text-[#FF8A1F]" />
              )}
              <span>Tümünü Okundu İşaretle</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="surface-card p-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-app)]">
          <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
          <span>Bildirimler yükleniyor...</span>
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const isUnread = !notif.read_at;

            return (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`surface-card p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isUnread
                    ? 'border-[#FF8A1F]/30 bg-gradient-to-r from-[var(--brand-orange-subtle)]/30 to-[var(--bg-surface)] shadow-sm'
                    : 'border-[var(--border-app)] hover:border-[var(--border-app)]/80'
                }`}
              >
                {/* Left side indicator for unread */}
                {isUnread && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full bg-[#FF8A1F]" />
                )}

                <div className="flex items-start gap-4 pl-2">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(notif.type)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm ${
                          isUnread
                            ? 'font-extrabold text-[var(--text-main)]'
                            : 'font-semibold text-[var(--text-main)]/90'
                        }`}
                      >
                        {notif.title}
                      </h3>
                      {isUnread && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FF8A1F] text-black">
                          YENİ
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-xs leading-relaxed max-w-2xl ${
                        isUnread ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)] pt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDateTime(notif.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 text-[#FF8A1F]" />
                      <span>Okundu İşaretle</span>
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label="Bildirimi sil"
                    onClick={(e) => { e.stopPropagation(); handleDelete([notif.id]); }}
                    className="btn-secondary text-xs py-1.5 px-2.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {notif.entity_id && (
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {hasMore && activeTab === 'ALL' && (
            <div className="flex justify-center pt-3">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary text-xs px-5 py-2">
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : '5 Daha Yükle'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="surface-card p-12 text-center space-y-3 rounded-2xl border border-[var(--border-app)]">
          <Bell className="w-10 h-10 mx-auto text-[var(--text-dim)] stroke-1" />
          <h3 className="text-sm font-bold text-[var(--text-main)]">
            {activeTab === 'UNREAD' ? 'Okunmamış bildiriminiz yok.' : 'Henüz bildirim bulunmuyor.'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            İlanlarınız, fiyat düşüşleri ve destek yanıtları bildirim kutunuzda anında listelenir.
          </p>
        </div>
      )}
    </div>
  );
}

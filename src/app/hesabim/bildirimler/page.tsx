'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { Notification } from '@/types';
import { formatDateTime } from '@/lib/utils/format';

export default function HesabimBildirimlerPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotifications();
    }
  }, [isAuthenticated, user]);

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

  const handleItemClick = (notif: Notification) => {
    if (!notif.read_at && user) {
      handleMarkAsRead(notif.id);
    }

    if (notif.entity_type === 'listing' && notif.entity_id) {
      router.push(`/ilan/${notif.entity_id}`);
    } else if (notif.entity_type === 'ticket' && notif.entity_id) {
      router.push(`/hesabim/destek/${notif.entity_id}`);
    }
  };

  const filteredNotifications =
    activeTab === 'UNREAD'
      ? notifications.filter((n) => !n.read_at)
      : notifications;

  const getIcon = (type: string) => {
    switch (type) {
      case 'LISTING_PRICE_DROP':
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
              Tümü ({notifications.length})
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

'use client';

import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Notification } from '@/types';

export function NotificationDropdown() {
  const router = useRouter();
  const { user, currentProfile, isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!currentProfile?.id) return;
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (isAuthenticated && currentProfile?.id) {
      fetchNotifications();
      // Polling or refresh interval
      const interval = setInterval(fetchNotifications, 20000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, currentProfile?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
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
    setLoading(true);

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
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read_at && user) {
      // Mark read in background
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markRead',
          userId: user.id,
          notificationId: notif.id,
        }),
      }).then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      });
    }

    setIsOpen(false);

    if (notif.entity_type === 'listing' && notif.entity_id) {
      router.push(`/ilan/${notif.entity_id}`);
    } else if (notif.entity_type === 'ticket' && notif.entity_id) {
      router.push(`/hesabim/destek/${notif.entity_id}`);
    } else {
      router.push('/hesabim/bildirimler');
    }
  };

  if (!isAuthenticated || !user) return null;

  const hasUnread = unreadCount > 0;
  const recentNotifications = notifications.slice(0, 5);

  const formatRelativeTime = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'LISTING_PRICE_DROP':
      case 'LISTING_PRICE_CHANGE':
        return <ArrowDownCircle className="w-4 h-4 text-[#FF8A1F]" />;
      case 'SUPPORT_REPLY':
        return <LifeBuoy className="w-4 h-4 text-emerald-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#FF8A1F]" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className={`relative p-2 rounded-xl border border-[var(--border-app)] transition-colors cursor-pointer flex items-center justify-center ${
          hasUnread
            ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border-[#FF8A1F]/40'
            : 'bg-[var(--bg-surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'
        }`}
        aria-label="Bildirimler"
        aria-expanded={isOpen}
      >
        <Bell className={`w-4 h-4 ${hasUnread ? 'text-[#FF8A1F] fill-[#FF8A1F]/20' : ''}`} />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#FF8A1F] text-black font-extrabold text-[10px] leading-tight shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 sm:right-auto sm:left-auto md:right-0 mt-2 w-[340px] sm:w-[380px] rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-[var(--border-app)] flex items-center justify-between bg-[var(--bg-surface-secondary)]/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--text-main)]">Bildirimler</span>
              {hasUnread && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF8A1F] text-black">
                  {unreadCount} yeni
                </span>
              )}
            </div>

            {hasUnread && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs font-semibold text-[#FF8A1F] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                <span>Tümünü Okundu İşaretle</span>
              </button>
            )}
          </div>

          {/* Notification Items */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-[var(--border-app)]">
            {recentNotifications.length > 0 ? (
              recentNotifications.map((notif) => {
                const isUnread = !notif.read_at;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 px-4 flex items-start gap-3 transition-colors cursor-pointer relative group ${
                      isUnread
                        ? 'bg-[var(--brand-orange-subtle)]/35 hover:bg-[var(--brand-orange-subtle)]/50'
                        : 'hover:bg-[var(--bg-surface-secondary)]/70'
                    }`}
                  >
                    {/* Unread dot indicator */}
                    {isUnread && (
                      <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-[#FF8A1F]" />
                    )}

                    <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] flex items-center justify-center shrink-0 mt-0.5">
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`text-xs truncate ${
                            isUnread
                              ? 'font-bold text-[var(--text-main)]'
                              : 'font-medium text-[var(--text-muted)]'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-[var(--text-dim)] shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>

                      <p
                        className={`text-xs line-clamp-2 leading-relaxed ${
                          isUnread ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {notif.message}
                      </p>
                    </div>

                    {/* Single Mark Read Action on Hover */}
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(e, notif.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[#FF8A1F] transition-all shrink-0 cursor-pointer"
                        title="Okundu İşaretle"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-[var(--text-muted)] space-y-1">
                <Bell className="w-6 h-6 mx-auto text-[var(--text-dim)] stroke-1" />
                <p className="font-semibold text-[var(--text-main)]">Henüz bildiriminiz yok</p>
                <p className="text-[11px] text-[var(--text-dim)]">
                  İlanlarınızla ilgili gelişmeler ve destek yanıtları burada listelenir.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 px-4 border-t border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/50 text-center">
            <Link
              href="/hesabim/bildirimler"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[#FF8A1F] hover:underline inline-flex items-center gap-1.5"
            >
              <span>Tüm Bildirimleri Gör</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

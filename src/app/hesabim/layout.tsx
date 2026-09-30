'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { resolveAvatarUrl } from '@/lib/media/url';
import {
  LayoutDashboard,
  ListPlus,
  Heart,
  User,
  CreditCard,
  Building2,
  LifeBuoy,
  Crown,
  Shield,
  ArrowRight,
  Bell,
} from 'lucide-react';
import { getCorporateSidebarLabel } from '@/lib/dealers/status';

export default function HesabimLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentProfile, isAuthenticated, isLoading, isAdmin } = useAuth();

  const [headerImgError, setHeaderImgError] = useState(false);
  const [corporateEligibility, setCorporateEligibility] = useState<{
    eligible: boolean;
    reason: string;
    dealer?: any;
  } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/giris?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  useEffect(() => {
    if (!currentProfile?.id) return;
    let isCancelled = false;

    fetch('/api/dealers/eligibility')
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data) {
          setCorporateEligibility(data);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [currentProfile?.id]);

  if (isLoading || !currentProfile) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-xs text-[var(--text-muted)]">
        <div className="w-8 h-8 rounded-full border-2 border-[#FF8A1F] border-t-transparent animate-spin" />
        <span>Oturum bilgileri yükleniyor...</span>
      </div>
    );
  }

  const avatarSrc = currentProfile.avatar_path || currentProfile.avatar_url;
  const resolvedAvatar = avatarSrc ? resolveAvatarUrl(avatarSrc) : '';

  const corporateReason = corporateEligibility?.reason;
  const isDeletedStore = corporateReason === 'STORE_DELETED';
  const isSuspendedStore = corporateReason === 'STORE_SUSPENDED';
  const hasApprovedCorporate =
    corporateReason === 'ACTIVE' ||
    corporateReason === 'SUBSCRIPTION_EXPIRED' ||
    corporateReason === 'SUBSCRIPTION_INACTIVE';

  const corporateResolved = corporateEligibility !== null;
  const corporateLabel = corporateResolved ? getCorporateSidebarLabel({
    hasApprovedStore: hasApprovedCorporate,
    subscriptionStatus:
      corporateEligibility?.dealer?.subscription_status || (hasApprovedCorporate ? 'ACTIVE' : null),
    moderationStatus: isDeletedStore
      ? 'DELETED'
      : isSuspendedStore
      ? 'SUSPENDED'
      : corporateEligibility?.dealer?.moderation_status,
    isDealer: Boolean(hasApprovedCorporate),
  }) : null;

  const isCorporateIdentity = corporateLabel === 'Kurumsal Profil';
  const isKurumsalPage = pathname === '/hesabim/kurumsal' || pathname.startsWith('/hesabim/kurumsal/');

  const menuItems = [
    { href: '/hesabim', label: 'Genel Bakış', icon: LayoutDashboard, iconAccent: 'text-orange-400 bg-orange-400/10' },
    { href: '/hesabim/profil', label: 'Profilim', icon: User, iconAccent: 'text-blue-400 bg-blue-400/10' },
    { href: '/hesabim/ilanlarim', label: 'İlanlarım', icon: ListPlus, iconAccent: 'text-amber-400 bg-amber-400/10' },
    { href: '/hesabim/favorilerim', label: 'Favorilerim', icon: Heart, iconAccent: 'text-rose-400 bg-rose-400/10' },
    { href: '/hesabim/bildirimler', label: 'Bildirimler', icon: Bell, iconAccent: 'text-orange-400 bg-orange-400/10' },
    { href: '/hesabim/odemeler', label: 'Ödeme Geçmişim', icon: CreditCard, iconAccent: 'text-emerald-400 bg-emerald-400/10' },
    { href: '/hesabim/destek', label: 'Destek', icon: LifeBuoy, iconAccent: 'text-violet-400 bg-violet-400/10' },
    ...(isAdmin
      ? [{ href: '/yonetim', label: 'Admin Panel', icon: Shield, iconAccent: 'text-red-400 bg-red-400/10', badge: 'ADMİN' }]
      : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Character Identity Header Spanning Full Width */}
      <div className="surface-card p-6 sm:p-7 rounded-2xl border border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-sm">
        <div className="flex items-center gap-5">
          {resolvedAvatar && !headerImgError ? (
            <img
              src={resolvedAvatar}
              alt={currentProfile.full_name}
              onError={() => setHeaderImgError(true)}
              className="w-16 h-16 rounded-full object-cover border-2 border-[#FF8A1F] shadow-sm shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border-2 border-[#FF8A1F] flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
              {currentProfile.full_name?.charAt(0) || 'U'}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Karakter Paneli</span>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Shield className="w-3 h-3" />
                  Yönetici
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-[var(--text-main)] tracking-tight">
              {currentProfile.full_name}
            </h1>

            {/* SanMail only if configured, otherwise subtle CTA */}
            {currentProfile.sanmail_email ? (
              <p className="text-xs font-medium text-[#FF8A1F]">{currentProfile.sanmail_email}</p>
            ) : (
              <Link
                href="/hesabim/profil"
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[#FF8A1F] transition-colors"
              >
                <span>İletişim bilgilerini tamamla</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

      </div>

      {/* Main Grid: Shared Alignments (Sidebar + Content) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sticky Sidebar Navigation */}
        <aside className="lg:col-span-3 surface-card p-3 rounded-2xl border border-[var(--border-app)] space-y-1 lg:sticky lg:top-24 shadow-sm">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 motion-reduce:transition-none ${
                  isActive
                    ? 'border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)] text-[#FF8A1F] shadow-[inset_3px_0_0_#FF8A1F]'
                    : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-app)] hover:bg-[var(--bg-surface-secondary)]/65 hover:text-[var(--text-main)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.iconAccent}`}><Icon className="h-4 w-4" /></span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FF8A1F] text-black">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div data-sidebar-footer="corporate" className="pt-3 border-t border-[var(--border-app)] mt-3">
            {corporateResolved && corporateLabel ? (
              <Link
                href="/hesabim/kurumsal"
                data-corporate-item="true"
                aria-current={isKurumsalPage ? 'page' : undefined}
                className={`group relative flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-[color,background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none ${
                  isKurumsalPage
                    ? 'border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)] text-[#FF8A1F] shadow-[inset_3px_0_0_#FF8A1F]'
                    : 'border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/30 text-[var(--text-main)] hover:border-[#FF8A1F]/25 hover:bg-[var(--bg-surface-secondary)]/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF8A1F]/10 text-[#FF9D45]">
                    {isCorporateIdentity ? <Crown className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  </span>
                  <span>{corporateLabel}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--text-dim)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <div data-corporate-loading="true" aria-label="Kurumsal durum yükleniyor" className="flex items-center gap-3 rounded-xl border border-[var(--border-app)] px-3 py-2">
                <span className="h-8 w-8 animate-pulse rounded-lg bg-[var(--bg-surface-secondary)]" />
                <span className="h-3 w-28 animate-pulse rounded bg-[var(--bg-surface-secondary)]" />
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main key={pathname} className="dashboard-page-enter lg:col-span-9 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

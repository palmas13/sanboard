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
  Phone,
  CreditCard,
  LogOut,
  PlusCircle,
  Building2,
  LifeBuoy,
  Crown,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { getCorporateSidebarLabel, resolveCorporateHeaderActions } from '@/lib/dealers/status';

export default function HesabimLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentProfile, isAuthenticated, isLoading, isAdmin, logout } = useAuth();

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

    fetch(`/api/dealers/eligibility?profileId=${currentProfile.id}`)
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

  const corporateLabel = getCorporateSidebarLabel({
    hasApprovedStore: hasApprovedCorporate,
    subscriptionStatus:
      corporateEligibility?.dealer?.subscription_status || (hasApprovedCorporate ? 'ACTIVE' : null),
    moderationStatus: isDeletedStore
      ? 'DELETED'
      : isSuspendedStore
      ? 'SUSPENDED'
      : corporateEligibility?.dealer?.moderation_status,
    isDealer: Boolean(hasApprovedCorporate),
  });

  const isCorporateIdentity = corporateLabel === 'Kurumsal Profil';
  const isKurumsalPage = pathname === '/hesabim/kurumsal';

  // Section 7, 8, 9: Canonical eligibility resolver for header actions
  const { canOpenStore, canCreateCorporateListing } = resolveCorporateHeaderActions({
    eligibility: corporateEligibility as any,
    activeProfileId: currentProfile?.id,
    isCorporatePage: isKurumsalPage,
  });

  const menuItems = [
    { href: '/hesabim', label: 'Genel Bakış', icon: LayoutDashboard },
    { href: '/hesabim/profil', label: 'Profilim', icon: User },
    { href: '/hesabim/iletisim', label: 'İletişim Bilgilerim', icon: Phone },
    { href: '/hesabim/ilanlarim', label: 'İlanlarım', icon: ListPlus },
    { href: '/hesabim/favorilerim', label: 'Favorilerim', icon: Heart },
    { href: '/hesabim/odemeler', label: 'Ödeme Geçmişim', icon: CreditCard },
    { href: '/hesabim/destek', label: 'Destek', icon: LifeBuoy },
    {
      href: '/hesabim/kurumsal',
      label: corporateLabel,
      icon: isCorporateIdentity ? Crown : Building2,
      badge: isCorporateIdentity ? 'PRO' : undefined,
    },
    ...(isAdmin
      ? [{ href: '/yonetim', label: 'Admin Panel', icon: Shield, badge: 'ADMİN' }]
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
              {currentProfile.is_dealer && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[rgba(255,138,31,0.25)]">
                  <Crown className="w-3 h-3" />
                  Kurumsal Mağaza
                </span>
              )}
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
                href="/hesabim/iletisim"
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[#FF8A1F] transition-colors"
              >
                <span>İletişim bilgilerini tamamla</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {canOpenStore && (
            <Link
              href={`/premium/${corporateEligibility?.dealer?.public_id || corporateEligibility?.dealer?.id}`}
              className="btn-secondary text-xs py-2.5 px-4 shadow-sm"
              target="_blank"
            >
              <span>Mağazamı Aç</span>
            </Link>
          )}

          {isKurumsalPage ? (
            canCreateCorporateListing && (
              <Link
                href="/ilan-ver/yeni?corporate=true"
                className="btn-primary text-xs py-2.5 px-4 shadow-sm flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Yeni İlan Ver</span>
              </Link>
            )
          ) : (
            <Link
              href="/ilan-ver"
              className="btn-primary text-xs py-2.5 px-4 shadow-sm flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Yeni İlan Ver</span>
            </Link>
          )}
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
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'text-[#FF8A1F] bg-[var(--brand-orange-subtle)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
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

          <div className="pt-2 border-t border-[var(--border-app)] mt-2">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-colors text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-9 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

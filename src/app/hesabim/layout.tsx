'use client';

import React, { useEffect } from 'react';
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
} from 'lucide-react';

export default function HesabimLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentProfile, isAuthenticated, isAdmin, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !currentProfile) {
      router.push(`/giris?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, currentProfile, router, pathname]);

  if (!isAuthenticated || !currentProfile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-sm text-[var(--text-muted)]">
        Giriş kontrol ediliyor...
      </div>
    );
  }

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
      label: currentProfile.is_dealer ? 'Mağazam' : 'Kurumsal Başvuru',
      icon: currentProfile.is_dealer ? Crown : Building2,
      badge: currentProfile.is_dealer ? 'PRO' : undefined,
    },
    ...(isAdmin
      ? [{ href: '/yonetim', label: 'Admin Panel', icon: Shield, badge: 'ADMİN' }]
      : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="surface-card p-6 rounded-2xl border border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={resolveAvatarUrl(currentProfile.avatar_path || currentProfile.avatar_url)}
            alt={currentProfile.full_name}
            className="w-14 h-14 rounded-full object-cover border-2 border-[#FF8A1F] shadow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-[var(--text-muted)]">Karakter Paneli</p>
              {currentProfile.is_dealer && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[rgba(255,138,31,0.25)]">
                  <Crown className="w-3 h-3" />
                  Kurumsal Mağaza
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-[var(--text-main)]">
              {currentProfile.full_name}
            </h1>
            <p className="text-xs text-[#FF8A1F] mt-0.5">{currentProfile.sanmail_email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {currentProfile.is_dealer && currentProfile.dealer_id && (
            <Link
              href={`/magaza/${currentProfile.dealer_id}`}
              className="btn-secondary text-xs py-2.5 px-3.5 shadow-sm"
              target="_blank"
            >
              <span>Mağazamı Aç</span>
            </Link>
          )}
          <Link
            href="/ilan-ver"
            className="btn-primary text-xs py-2.5 px-4 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Yeni İlan Ver</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Sidebar + Subpage Content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* Sidebar Nav */}
        <aside className="surface-card p-3 rounded-2xl border border-[var(--border-app)] space-y-1 md:sticky md:top-20">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
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
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#FF8A1F] text-black">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-2 border-t border-[var(--border-app)] mt-2">
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </aside>

        {/* Dynamic Subpage Section */}
        <main className="md:col-span-3">{children}</main>
      </div>
    </div>
  );
}

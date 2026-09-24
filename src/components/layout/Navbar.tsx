'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Car,
  Home,
  Heart,
  PlusCircle,
  User as UserIcon,
  LogOut,
  Settings,
  CreditCard,
  ListPlus,
  Shield,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { SanboardLogo } from '../common/SanboardLogo';
import { ThemeToggle } from '../common/ThemeToggle';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { useAuth } from '@/features/auth/AuthContext';
import { resolveAvatarUrl } from '@/lib/media/url';

export function Navbar() {
  const pathname = usePathname();
  const { currentProfile, isAuthenticated, isLoading, isAdmin, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navbarImgError, setNavbarImgError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/arac', label: 'Araç', icon: Car },
    { href: '/mulk', label: 'Mülk', icon: Home },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-app)] bg-[var(--bg-surface)]/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Desktop Nav Links */}
        <div className="flex items-center gap-8">
          <SanboardLogo size="md" />

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}?`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-[#FF8A1F] bg-[var(--brand-orange-subtle)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right CTA / Auth & Theme */}
        <div className="flex items-center gap-3">
          {/* İlan Ver CTA */}
          <Link
            href="/ilan-ver"
            className="hidden sm:inline-flex btn-primary text-sm py-2 px-4 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>İlan Ver</span>
          </Link>

          <ThemeToggle />

          {/* Notification Center */}
          <NotificationDropdown />

          {/* User Auth Section */}
          {isAuthenticated && currentProfile ? (() => {
            const rawAvatar = currentProfile.avatar_path || currentProfile.avatar_url;
            const resolvedNavAvatar = resolveAvatarUrl(rawAvatar);
            const navInitials = currentProfile.full_name
              ? currentProfile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
              : 'SB';

            return (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                  aria-expanded={dropdownOpen}
                >
                  {resolvedNavAvatar && !navbarImgError ? (
                    <img
                      src={resolvedNavAvatar}
                      alt={currentProfile.full_name}
                      onError={() => setNavbarImgError(true)}
                      className="w-7 h-7 rounded-full object-cover border border-[var(--border-app)]"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] font-bold text-[11px] flex items-center justify-center border border-[#FF8A1F]/30 shrink-0">
                      {navInitials}
                    </div>
                  )}
                  <span className="hidden sm:inline text-xs font-semibold text-[var(--text-main)] max-w-[110px] truncate">
                    {currentProfile.full_name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-[var(--border-app)]">
                    <p className="text-xs text-[var(--text-muted)]">Oturum açıldı</p>
                    <p className="text-sm font-bold text-[var(--text-main)] truncate">
                      {currentProfile.full_name}
                    </p>
                    <p className="text-xs text-[#FF8A1F] truncate mt-0.5">
                      {currentProfile.sanmail_email}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/hesabim"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)] transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-[var(--text-muted)]" />
                      Hesabım
                    </Link>
                    <Link
                      href="/hesabim/ilanlarim"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)] transition-colors"
                    >
                      <ListPlus className="w-4 h-4 text-[var(--text-muted)]" />
                      İlanlarım
                    </Link>
                    <Link
                      href="/hesabim/favorilerim"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)] transition-colors"
                    >
                      <Heart className="w-4 h-4 text-[var(--text-muted)]" />
                      Favorilerim
                    </Link>
                    <Link
                      href="/hesabim/odemeler"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)] transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
                      Ödemelerim
                    </Link>
                    <Link
                      href="/hesabim/profil"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)] transition-colors"
                    >
                      <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                      Profil Ayarları
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/yonetim"
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#FF8A1F] font-semibold hover:bg-[var(--brand-orange-subtle)] transition-colors border-t border-[var(--border-app)] mt-1"
                      >
                        <Shield className="w-4 h-4" />
                        Admin Paneli
                      </Link>
                    )}
                  </div>

                  <div className="pt-1 border-t border-[var(--border-app)]">
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })() : isLoading ? (
            <div className="h-8 w-20 rounded-lg bg-[var(--bg-surface-secondary)] animate-pulse border border-[var(--border-app)]" />
          ) : (
            <Link
              href="/giris"
              className="btn-secondary text-sm py-2 px-4 font-semibold"
            >
              Giriş Yap
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)] cursor-pointer"
            aria-label="Menüyü aç"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border-app)] bg-[var(--bg-surface)] px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-150">
          <Link
            href="/ilan-ver"
            className="w-full btn-primary text-sm py-2.5 flex justify-center mb-3"
          >
            <PlusCircle className="w-4 h-4" />
            İlan Ver
          </Link>

          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'text-[#FF8A1F] bg-[var(--brand-orange-subtle)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {isAdmin && (
            <div className="pt-2 border-t border-[var(--border-app)]">
              <Link
                href="/yonetim"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-[#FF8A1F] font-semibold hover:bg-[var(--brand-orange-subtle)]"
              >
                <Shield className="w-4 h-4" />
                Admin Paneli
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

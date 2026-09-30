'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BadgeHelp, BookOpenText, Building2, Car, ChevronDown, CreditCard, FileCheck2, Heart, Home, Info, ListPlus, LogOut, Menu, PlusCircle, Settings, Shield, ShieldCheck, User as UserIcon, X as CloseIcon } from 'lucide-react';
import { SanboardLogo } from '../common/SanboardLogo';
import { ThemeToggle } from '../common/ThemeToggle';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { useAuth } from '@/features/auth/AuthContext';
import { resolveAvatarUrl } from '@/lib/media/url';

const navLinks = [
  { href: '/arac', label: 'Araç', icon: Car },
  { href: '/mulk', label: 'Mülk', icon: Home },
];

const infoLinks = [
  { href: '/kesfet?section=sss', label: 'S.S.S', description: 'Sık sorulan sorulara hızlı yanıtlar.', icon: BadgeHelp },
  { href: '/kesfet?section=kullanim-kosullari', label: 'Kullanım Koşulları', description: 'Platform kuralları ve ilan esasları.', icon: FileCheck2 },
  { href: '/kesfet?section=gizlilik', label: 'Gizlilik', description: 'Veriler ve görünürlük politikamız.', icon: ShieldCheck },
  { href: '/kesfet?section=hakkimizda', label: 'Hakkımızda', description: 'Sanboard’un yaklaşımı ve platform mantığı.', icon: Info },
];

const accountLinks = [
  { href: '/hesabim', label: 'Hesabım', icon: UserIcon, iconClass: 'text-[#FF9D45] bg-[#FF8A1F]/10' },
  { href: '/hesabim/ilanlarim', label: 'İlanlarım', icon: ListPlus, iconClass: 'text-amber-400 bg-amber-400/10' },
  { href: '/hesabim/favorilerim', label: 'Favorilerim', icon: Heart, iconClass: 'text-rose-400 bg-rose-400/10' },
  { href: '/hesabim/odemeler', label: 'Ödemelerim', icon: CreditCard, iconClass: 'text-emerald-400 bg-emerald-400/10' },
  { href: '/hesabim/profil', label: 'Profil Ayarları', icon: Settings, iconClass: 'text-slate-400 bg-slate-400/10' },
];

export function Navbar() {
  const pathname = usePathname();
  const { currentProfile, isAuthenticated, isLoading, isAdmin, isTestIdentity, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navbarImgError, setNavbarImgError] = useState(false);
  const [hasActiveCorporateProfile, setHasActiveCorporateProfile] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const infoDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) setDropdownOpen(false);
      if (infoDropdownRef.current && !infoDropdownRef.current.contains(target)) setInfoMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
    setInfoMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setHasActiveCorporateProfile(false);
    if (!isAuthenticated || !currentProfile?.id) return;

    let cancelled = false;
    const controller = new AbortController();

    fetch('/api/dealers/eligibility', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled) return;
        const dealer = data?.dealer;
        const expiresAt = dealer?.subscription_expires_at;
        setHasActiveCorporateProfile(Boolean(
          data?.eligible === true &&
          data?.reason === 'ACTIVE' &&
          dealer &&
          dealer.status === 'APPROVED' &&
          dealer.subscription_status === 'ACTIVE' &&
          dealer.moderation_status === 'ACTIVE' &&
          !dealer.deleted_at &&
          (!expiresAt || new Date(expiresAt).getTime() > Date.now())
        ));
      })
      .catch(() => {
        if (!cancelled) setHasActiveCorporateProfile(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentProfile?.id, isAuthenticated]);

  const isInfoActive = pathname === '/kesfet';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[color:var(--border-app)]/80 bg-[var(--bg-surface)]/88 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-colors">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5 lg:gap-8">
          <SanboardLogo size="md" className="shrink-0" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return <Link key={link.href} href={link.href} className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)]/70 hover:text-[var(--text-main)]'}`}><Icon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />{link.label}<span className={`absolute inset-x-3 -bottom-[6px] h-0.5 rounded-full bg-[#FF8A1F] transition-all duration-200 ${isActive ? 'opacity-100' : 'scale-x-50 opacity-0 group-hover:scale-x-100 group-hover:opacity-70'}`} /></Link>;
            })}
            <div className="relative" ref={infoDropdownRef}>
              <button type="button" onClick={() => setInfoMenuOpen((open) => !open)} className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isInfoActive || infoMenuOpen ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)]/70 hover:text-[var(--text-main)]'}`} aria-expanded={infoMenuOpen} aria-haspopup="menu"><BookOpenText className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />Keşfet<ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${infoMenuOpen ? 'rotate-180' : ''}`} /></button>
              {infoMenuOpen && <div className="dropdown-enter absolute left-0 top-full mt-3 w-[420px] overflow-hidden rounded-2xl border border-[color:var(--border-app)]/90 bg-[var(--bg-surface)]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl" role="menu">
                <div className="mb-1 rounded-xl border border-[#FF8A1F]/15 bg-gradient-to-r from-[#FF8A1F]/10 to-transparent px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF8A1F]">Keşfet Akışı</p><p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Platformu tanıyın, kuralları inceleyin ve merak ettiklerinize ulaşın.</p></div>
                <div className="grid grid-cols-2 gap-1">{infoLinks.map((link) => { const Icon = link.icon; return <Link key={link.href} href={link.href} role="menuitem" className="group flex gap-3 rounded-xl p-3 transition-colors duration-200 hover:bg-[var(--bg-surface-secondary)]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#FF8A1F]/15 bg-[#FF8A1F]/8 text-[#FF9D45] transition-all duration-200 group-hover:border-[#FF8A1F]/30 group-hover:bg-[#FF8A1F]/15"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-[var(--text-main)] group-hover:text-[#FF8A1F]">{link.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-muted)]">{link.description}</span></span></Link>; })}</div>
              </div>}
            </div>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <Link href="/ilan-ver" className="btn-primary hidden px-4 py-2 text-sm shadow-sm sm:inline-flex"><PlusCircle className="h-4 w-4" /><span>İlan Ver</span></Link>
          <ThemeToggle />
          <NotificationDropdown />
          {isAuthenticated && currentProfile ? (() => {
            const resolvedNavAvatar = resolveAvatarUrl(currentProfile.avatar_path || currentProfile.avatar_url);
            const initials = currentProfile.full_name ? currentProfile.full_name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase() : 'SB';
            const avatar = (size: string) => resolvedNavAvatar && !navbarImgError ? <img src={resolvedNavAvatar} alt="" onError={() => setNavbarImgError(true)} className={`${size} rounded-xl border border-[#FF8A1F]/20 object-cover`} /> : <div className={`${size} flex shrink-0 items-center justify-center rounded-xl border border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)] text-xs font-extrabold text-[#FF8A1F]`}>{initials}</div>;
            return <div className="relative" ref={userDropdownRef}>
              <button type="button" onClick={() => setDropdownOpen((open) => !open)} className={`flex items-center gap-2 rounded-xl border p-1.5 pr-2 transition-all duration-200 ${dropdownOpen ? 'border-[#FF8A1F]/40 bg-[var(--brand-orange-subtle)] shadow-[0_0_0_3px_rgba(255,138,31,0.06)]' : 'border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/65 hover:border-[var(--border-app-hover)] hover:bg-[var(--bg-surface-hover)]'}`} aria-expanded={dropdownOpen} aria-haspopup="menu">{avatar('h-8 w-8')}<span className="hidden max-w-[110px] truncate text-xs font-semibold text-[var(--text-main)] sm:inline">{currentProfile.full_name}</span>{isTestIdentity && <span className="hidden rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-500 lg:inline">TEST</span>}<ChevronDown className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} /></button>
              {dropdownOpen && <div className="dropdown-enter absolute right-0 top-full mt-3 w-[292px] overflow-hidden rounded-2xl border border-[color:var(--border-app)]/90 bg-[var(--bg-surface)]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-xl" role="menu">
                <div className="relative overflow-hidden rounded-xl border border-[#FF8A1F]/15 bg-gradient-to-br from-[#FF8A1F]/12 via-[var(--bg-surface-secondary)] to-[var(--bg-surface-secondary)] p-3.5"><div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#FF8A1F]/10 blur-2xl" /><div className="relative flex items-center gap-3">{avatar('h-11 w-11')}<div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold text-[var(--text-main)]">{currentProfile.full_name}</p>{isTestIdentity && <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-500">TEST</span>}</div><p className="mt-0.5 truncate text-[11px] text-[#FF9D45]">{currentProfile.sanmail_email}</p><p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)]">Aktif karakter</p></div></div></div>
                <div className="my-2 space-y-0.5" role="group">{accountLinks.map((link) => { const Icon = link.icon; const active = pathname === link.href; return <Link key={link.href} href={link.href} role="menuitem" className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200 ${active ? 'bg-[var(--brand-orange-subtle)] font-semibold text-[#FF8A1F]' : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)]'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${link.iconClass}`}><Icon className="h-4 w-4" /></span><span>{link.label}</span></Link>; })}{hasActiveCorporateProfile && <Link href="/hesabim/kurumsal" role="menuitem" className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface-secondary)]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF8A1F]/10 text-[#FF8A1F]"><Building2 className="h-4 w-4" /></span>Kurumsal Profil</Link>}{isAdmin && <Link href="/yonetim" role="menuitem" className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-[#FF8A1F] transition-colors hover:bg-[var(--brand-orange-subtle)]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF8A1F]/10"><Shield className="h-4 w-4" /></span>Admin Paneli</Link>}</div>
                <div className="border-t border-[color:var(--border-app)]/70 pt-2"><button type="button" onClick={logout} role="menuitem" className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-subtle)]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-danger-subtle)] transition-transform duration-200 group-hover:scale-105"><LogOut className="h-4 w-4" /></span><span className="font-medium">Çıkış Yap</span></button></div>
              </div>}
            </div>;
          })() : isLoading ? <div className="h-9 w-20 animate-pulse rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]" /> : <Link href="/giris" className="btn-secondary px-3.5 py-2 text-sm font-semibold">Giriş Yap</Link>}
          <button type="button" onClick={() => { setDropdownOpen(false); setInfoMenuOpen(false); setMobileMenuOpen((open) => !open); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] text-[var(--text-main)] transition-all hover:border-[var(--border-app-hover)] hover:bg-[var(--bg-surface-secondary)] md:hidden" aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation-panel">{mobileMenuOpen ? <CloseIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>

      {mobileMenuOpen && <div id="mobile-navigation-panel" className="dropdown-enter fixed inset-x-0 top-[68px] max-h-[calc(100dvh-68px)] overflow-y-auto overscroll-contain border-t border-[color:var(--border-app)]/70 bg-[var(--bg-surface)]/98 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"><nav className="mx-auto max-w-7xl space-y-1" aria-label="Mobil menü">{navLinks.map((link) => { const Icon = link.icon; const active = pathname === link.href; return <Link key={link.href} href={link.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)]'}`}><Icon className="h-4 w-4" />{link.label}</Link>; })}<div className="my-3 border-t border-[color:var(--border-app)]/70 pt-3"><div className="mb-2 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF8A1F]"><BookOpenText className="h-3.5 w-3.5" />Keşfet Akışı</div><div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{infoLinks.map((link) => { const Icon = link.icon; return <Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--bg-surface-secondary)]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF8A1F]/10 text-[#FF9D45]"><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-[var(--text-main)]">{link.label}</span><span className="block text-[11px] text-[var(--text-muted)]">{link.description}</span></span></Link>; })}</div></div>{isAdmin && <Link href="/yonetim" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#FF8A1F] hover:bg-[var(--brand-orange-subtle)]"><Shield className="h-4 w-4" />Admin Paneli</Link>}</nav></div>}
    </header>
  );
}
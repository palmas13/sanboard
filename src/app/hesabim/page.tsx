'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import {
  ListPlus,
  Clock,
  Heart,
  CreditCard,
  ArrowRight,
  PlusCircle,
  Crown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function HesabimOverviewPage() {
  const { currentProfile } = useAuth();
  const [stats, setStats] = useState({
    activeListings: 0,
    expiredListings: 0,
    favoritesCount: 0,
    availableCredits: 0,
    totalReceivedFavorites: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProfile) return;

    async function fetchStats() {
      try {
        const res = await fetch('/api/account/bootstrap');
        if (res.ok) {
          const data = await res.json();
          if (data?.success) {
            setStats({
              activeListings: data.stats?.activeListings || 0,
              expiredListings: data.stats?.expiredListings || 0,
              favoritesCount: data.stats?.favoritesCount || 0,
              availableCredits: data.credits?.availableCredits || 0,
              totalReceivedFavorites: data.stats?.totalReceivedFavorites || 0,
            });
          }
        }
      } catch {
        // Fallback defaults
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [currentProfile]);

  const firstName = currentProfile?.full_name?.split(' ')[0] || 'Kullanıcı';

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="surface-card p-6 rounded-2xl border border-[var(--border-app)] space-y-1">
        <h2 className="text-xl font-black text-[var(--text-main)]">
          Merhaba, {firstName} 👋
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Kişisel ilanlarınızı yönetebilir, favorilerinizi inceleyebilir ve yeni ilan haklarınızı kullanabilirsiniz.
        </p>
      </div>

      {/* Credit Status Card */}
      {stats.availableCredits > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--brand-orange-subtle)] border border-[#FF8A1F]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF8A1F] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              {stats.availableCredits}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Kullanılabilir Bireysel İlan Hakkınız Var!
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Önceden edindiğiniz ilan hakkını kullanarak bireysel ilanınızı anında yayınlayabilirsiniz.
              </p>
            </div>
          </div>
          <Link
            href="/ilan-ver"
            className="btn-primary text-xs py-2 px-4 shadow-sm shrink-0"
          >
            İlanı Şimdi Oluştur
          </Link>
        </div>
      )}

      {/* Corporate Store Notice (Directs Store Owners to 'Mağazam' without mixing metrics) */}
      {currentProfile?.is_dealer && (
        <div className="p-4 rounded-2xl bg-[var(--bg-surface-secondary)] border border-[rgba(255,138,31,0.25)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center font-bold shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Kurumsal Mağaza Yönetimi
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Kurumsal mağazanıza ait envanter, başvuru ve mağaza istatistikleri ayrı olarak <strong className="text-[#FF8A1F]">Kurumsal Profil</strong> menüsü altında yer almaktadır.
              </p>
            </div>
          </div>
          <Link
            href="/hesabim/kurumsal"
            className="btn-secondary text-xs py-2 px-3.5 shadow-sm inline-flex items-center gap-1.5 shrink-0"
          >
            <span>Mağazama Git</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#FF8A1F]" />
          </Link>
        </div>
      )}

      {/* Stat Cards Grid: Strictly Personal Account Context */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Aktif Bireysel İlan */}
        <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center">
            <ListPlus className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] font-medium">Aktif Bireysel İlanlarım</p>
            {loading ? (
              <div className="h-8 w-12 rounded-lg bg-[var(--bg-surface-secondary)] animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-black text-[var(--text-main)]">
                {stats.activeListings}
              </p>
            )}
          </div>
        </div>

        {/* Süresi Dolan İlanlarım */}
        <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] font-medium">Süresi Dolan İlanlarım</p>
            {loading ? (
              <div className="h-8 w-12 rounded-lg bg-[var(--bg-surface-secondary)] animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-black text-[var(--text-main)]">
                {stats.expiredListings}
              </p>
            )}
          </div>
        </div>

        {/* Favorilerim */}
        <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] font-medium">Favorilerim</p>
            {loading ? (
              <div className="h-8 w-12 rounded-lg bg-[var(--bg-surface-secondary)] animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-black text-[var(--text-main)]">
                {stats.favoritesCount}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/hesabim/ilanlarim"
          className="surface-card surface-card-hover p-5 rounded-2xl border border-[var(--border-app)] flex items-center justify-between group"
        >
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[var(--text-main)] group-hover:text-[#FF8A1F] transition-colors">
              Bireysel İlanlarımı Yönet
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Aktif kişisel ilanlarını düzenle, kalan süreyi gör veya satıldı olarak işaretle.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-[var(--text-dim)] group-hover:text-[#FF8A1F] group-hover:translate-x-1 transition-all shrink-0 ml-4" />
        </Link>

        <Link
          href="/hesabim/odemeler"
          className="surface-card surface-card-hover p-5 rounded-2xl border border-[var(--border-app)] flex items-center justify-between group"
        >
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[var(--text-main)] group-hover:text-[#FF8A1F] transition-colors">
              Ödeme ve Hak Geçmişi
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Satın alınan bireysel ilan kredilerini ve ödeme geçmişinizi inceleyin.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-[var(--text-dim)] group-hover:text-[#FF8A1F] group-hover:translate-x-1 transition-all shrink-0 ml-4" />
        </Link>
      </div>
    </div>
  );
}

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
  TrendingUp,
  Sparkles,
  Crown,
  Building2,
  ExternalLink,
  Car,
  Home,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export default function HesabimOverviewPage() {
  const { currentProfile } = useAuth();
  const [stats, setStats] = useState({
    activeListings: 0,
    expiredListings: 0,
    favoritesCount: 0,
    totalPayments: 0,
    availableCredits: 0,
    vehicleCount: 0,
    propertyCount: 0,
    totalReceivedFavorites: 0,
  });
  const [dealerInfo, setDealerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProfile) return;

    async function fetchStats() {
      try {
        const promises: Promise<any>[] = [
          fetch(`/api/user/listings?profileId=${currentProfile?.id}`),
          fetch(`/api/user/favorites?profileId=${currentProfile?.id}`),
          fetch(`/api/user/payments?profileId=${currentProfile?.id}`),
          fetch(`/api/credits?profileId=${currentProfile?.id}`),
        ];

        if (currentProfile?.is_dealer) {
          promises.push(fetch(`/api/dealers/profile?profileId=${currentProfile.id}`));
        }

        const responses = await Promise.all(promises);
        const [listingsRes, favsRes, paymentsRes, creditsRes, dealerRes] = responses;

        const listings = await listingsRes.json();
        const favs = await favsRes.json();
        const payments = await paymentsRes.json();
        const credits = await creditsRes.json();
        const dealerData = dealerRes ? await dealerRes.json() : null;

        const activeListingsList = Array.isArray(listings)
          ? listings.filter((l: any) => l.status === 'ACTIVE')
          : [];
        const active = activeListingsList.length;
        const expired = Array.isArray(listings)
          ? listings.filter((l: any) => l.status === 'EXPIRED').length
          : 0;
        const totalPaid = Array.isArray(payments)
          ? payments
              .filter((p: any) => p.status === 'SUCCESS')
              .reduce((sum: number, p: any) => sum + p.amount, 0)
          : 0;

        const vehicles = activeListingsList.filter((l: any) => l.category === 'vehicle').length;
        const properties = activeListingsList.filter((l: any) => l.category === 'property').length;
        const totalReceivedFavs = Array.isArray(listings)
          ? listings.reduce((sum: number, l: any) => sum + (l.favorite_count || 0), 0)
          : 0;

        setStats({
          activeListings: active,
          expiredListings: expired,
          favoritesCount: Array.isArray(favs) ? favs.length : 0,
          totalPayments: totalPaid,
          availableCredits: credits.availableCredits || 0,
          vehicleCount: vehicles,
          propertyCount: properties,
          totalReceivedFavorites: totalReceivedFavs,
        });

        if (dealerData && dealerData.dealer) {
          setDealerInfo(dealerData.dealer);
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
          Sanboard kontrol panelinden aktif ilanlarını yönetebilir, favorilerini inceleyebilir ve yeni ilan haklarını kullanabilirsin.
        </p>
      </div>

      {/* Credit Status Card */}
      {stats.availableCredits > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--brand-orange-subtle)] border border-[#FF8A1F]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF8A1F] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {stats.availableCredits}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Kullanılabilir İlan Hakkınız Var!
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Önceden satın aldığınız ilan hakkını şimdi kullanarak anında ilan yayınlayabilirsiniz.
              </p>
            </div>
          </div>
          <Link
            href="/ilan-ver/yeni"
            className="btn-primary text-xs py-2 px-4 shadow-sm shrink-0"
          >
            İlanı Şimdi Oluştur
          </Link>
        </div>
      )}

      {/* Corporate Store Performance Banner (Only for approved corporate dealers) */}
      {currentProfile?.is_dealer && (
        <div className="surface-card p-6 rounded-2xl border border-[rgba(255,138,31,0.3)] bg-gradient-to-r from-[rgba(255,138,31,0.06)] via-[var(--bg-surface)] to-[var(--bg-surface)] space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-app)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF8A1F] text-black flex items-center justify-center font-bold shadow-md">
                <Crown className="w-5 h-5 text-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#FF8A1F] uppercase tracking-wider">Kurumsal Hesap</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Aktif Mağaza
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">
                  {dealerInfo?.company_name || 'Kurumsal Mağazanız'}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(currentProfile.dealer_id || dealerInfo?.id) && (
                <Link
                  href={`/magaza/${currentProfile.dealer_id || dealerInfo?.id}`}
                  target="_blank"
                  className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mağaza Vitrinini Gör</span>
                </Link>
              )}
              <Link
                href="/hesabim/kurumsal"
                className="btn-secondary text-xs py-2 px-3.5"
              >
                <span>Mağaza Ayarları</span>
              </Link>
            </div>
          </div>

          {/* Corporate Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-[11px] font-medium">Aktif Araç</span>
                <Car className="w-3.5 h-3.5 text-[#FF8A1F]" />
              </div>
              <p className="text-xl font-black text-[var(--text-main)]">
                {loading ? '-' : stats.vehicleCount}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-[11px] font-medium">Aktif Mülk</span>
                <Home className="w-3.5 h-3.5 text-[#FF8A1F]" />
              </div>
              <p className="text-xl font-black text-[var(--text-main)]">
                {loading ? '-' : stats.propertyCount}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-[11px] font-medium">Toplam İlan</span>
                <ListPlus className="w-3.5 h-3.5 text-[#FF8A1F]" />
              </div>
              <p className="text-xl font-black text-[var(--text-main)]">
                {loading ? '-' : stats.activeListings}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-[11px] font-medium">Alınan Favori</span>
                <Heart className="w-3.5 h-3.5 text-[#FF8A1F]" />
              </div>
              <p className="text-xl font-black text-[#FF8A1F]">
                {loading ? '-' : stats.totalReceivedFavorites}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Aktif İlan */}
        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center">
            <ListPlus className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] font-medium">Aktif İlan</p>
            <p className="text-2xl font-black text-[var(--text-main)]">
              {loading ? '-' : stats.activeListings}
            </p>
          </div>
        </div>

        {/* Süresi Dolan */}
        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-danger-subtle)] text-[var(--color-danger)] flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] font-medium">Süresi Dolan</p>
            <p className="text-2xl font-black text-[var(--text-main)]">
              {loading ? '-' : stats.expiredListings}
            </p>
          </div>
        </div>

        {/* Favoriler */}
        <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] font-medium">Favoriler</p>
            <p className="text-2xl font-black text-[var(--text-main)]">
              {loading ? '-' : stats.favoritesCount}
            </p>
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
              İlanlarımı Yönet
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Aktif ilanlarını düzenle, kalan süreyi gör veya satıldı olarak işaretle.
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
              Ödeme Geçmişi
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Fleeca üzerinden yapılan paket satın alma işlemlerini ve faturaları incele.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-[var(--text-dim)] group-hover:text-[#FF8A1F] group-hover:translate-x-1 transition-all shrink-0 ml-4" />
        </Link>
      </div>
    </div>
  );
}

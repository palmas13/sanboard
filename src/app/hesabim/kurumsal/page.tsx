'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Building2,
  Crown,
  CheckCircle2,
  Clock,
  Save,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Send,
  PlusCircle,
  ListPlus,
  LifeBuoy,
  Heart,
  Car,
  Home,
  Edit,
  BadgeCheck,
} from 'lucide-react';
import { DealerProfile } from '@/types';

export default function HesabimKurumsalPage() {
  const { currentProfile } = useAuth();
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Stats for approved dealers
  const [stats, setStats] = useState({
    activeListings: 0,
    vehicleListings: 0,
    propertyListings: 0,
    totalFavorites: 0,
  });

  // Application form fields
  const [companyName, setCompanyName] = useState('');
  const [purpose, setPurpose] = useState('');

  // Edit profile fields (for approved dealers)
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSanmail, setEditSanmail] = useState('');

  const editFormRef = useRef<HTMLDivElement>(null);

  const fetchDealer = async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        fetch(`/api/dealers/profile?profileId=${currentProfile.id}`),
        fetch(`/api/user/listings?profileId=${currentProfile.id}`),
      ];

      const [dealerRes, listingsRes] = await Promise.all(promises);
      const data = await dealerRes.json();
      const listings = await listingsRes.json();

      if (data.dealer) {
        setDealer(data.dealer);
        setEditCompanyName(data.dealer.company_name);
        setEditDescription(data.dealer.description);
        setEditLogoUrl(data.dealer.logo_url);
        setEditBannerUrl(data.dealer.banner_url);
        setEditAddress(data.dealer.address || '');
        setEditPhone(data.dealer.phone || '');
        setEditSanmail(data.dealer.sanmail_email || '');
      } else {
        setDealer(null);
      }

      if (Array.isArray(listings)) {
        const active = listings.filter((l) => l.status === 'ACTIVE');
        const vehicles = active.filter((l) => l.category === 'vehicle').length;
        const properties = active.filter((l) => l.category === 'property').length;
        const totalFavs = listings.reduce((sum, l) => sum + (l.favorite_count || 0), 0);

        setStats({
          activeListings: active.length,
          vehicleListings: vehicles,
          propertyListings: properties,
          totalFavorites: totalFavs,
        });
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealer();
  }, [currentProfile]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    if (!companyName.trim() || !purpose.trim()) {
      setError('Lütfen tüm alanları doldurunuz.');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/dealers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          companyName: companyName.trim(),
          purpose: purpose.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Başvuru iletilemedi.');

      setSuccess('Kurumsal başvurunuz başarıyla yönetime iletildi.');
      await fetchDealer();
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/dealers/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          company_name: editCompanyName,
          description: editDescription,
          logo_url: editLogoUrl,
          banner_url: editBannerUrl,
          address: editAddress,
          phone: editPhone,
          sanmail_email: editSanmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Güncellenemedi.');

      setSuccess('Kurumsal vitrin bilgileriniz başarıyla kaydedildi.');
      await fetchDealer();
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  const scrollToEditForm = () => {
    if (editFormRef.current) {
      editFormRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {success && (
        <div className="p-3.5 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-2 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2 border border-[rgba(229,72,77,0.3)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="surface-card p-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-app)]">
          <Loader2 className="w-5 h-5 animate-spin text-[#FF8A1F]" />
          <span>Kurumsal satıcı bilgileri getiriliyor...</span>
        </div>
      ) : dealer?.status === 'APPROVED' ? (
        <div className="space-y-6">
          {/* 1. UPPER PREMIUM HERO CARD */}
          <div className="relative rounded-2xl overflow-hidden border border-[#FF8A1F]/30 bg-gradient-to-br from-[#1a1208] via-[var(--bg-surface)] to-[var(--bg-surface)] shadow-xl">
            {/* Banner Background */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
              style={{
                backgroundImage: `url(${dealer.banner_url || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200'})`,
              }}
            />
            {/* Gradient Overlay for Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/80 to-transparent pointer-events-none" />

            {/* Hero Content */}
            <div className="relative p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Logo */}
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#FF8A1F] bg-[var(--bg-surface)] shadow-lg shrink-0 flex items-center justify-center">
                  <img
                    src={dealer.logo_url || 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200'}
                    alt={dealer.company_name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FF8A1F] text-black shadow-sm">
                      <Crown className="w-3 h-3 fill-current" />
                      PREMIUM SATICI
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <BadgeCheck className="w-3 h-3" />
                      ONAYLI KURUMSAL PROFİL
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] tracking-tight">
                    {dealer.company_name}
                  </h1>

                  <p className="text-xs text-[var(--text-muted)] max-w-xl line-clamp-2">
                    {dealer.description || 'Los Santos kurumsal vitrin sayfası ve lisanslı işletme.'}
                  </p>
                </div>
              </div>

              {/* Actions on Hero */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto shrink-0">
                <Link
                  href={`/magaza/${dealer.id}`}
                  target="_blank"
                  className="btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 shadow-md flex-1 sm:flex-none"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mağazayı Görüntüle</span>
                </Link>

                <button
                  type="button"
                  onClick={scrollToEditForm}
                  className="btn-secondary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 flex-1 sm:flex-none cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-[#FF8A1F]" />
                  <span>Profili Düzenle</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. COMPACT STATS GRID (NO TOPLAM ÖDEME) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Aktif İlan */}
            <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold">Aktif İlan</span>
                <ListPlus className="w-4 h-4 text-[var(--color-success)]" />
              </div>
              <p className="text-2xl font-black text-[var(--text-main)]">
                {stats.activeListings}
              </p>
            </div>

            {/* Araç İlanı */}
            <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold">Araç İlanı</span>
                <Car className="w-4 h-4 text-[#FF8A1F]" />
              </div>
              <p className="text-2xl font-black text-[var(--text-main)]">
                {stats.vehicleListings}
              </p>
            </div>

            {/* Mülk İlanı */}
            <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold">Mülk İlanı</span>
                <Home className="w-4 h-4 text-[#FF8A1F]" />
              </div>
              <p className="text-2xl font-black text-[var(--text-main)]">
                {stats.propertyListings}
              </p>
            </div>

            {/* Toplam Favori */}
            <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold">Toplam Favori</span>
                <Heart className="w-4 h-4 text-[#FF8A1F]" />
              </div>
              <p className="text-2xl font-black text-[#FF8A1F]">
                {stats.totalFavorites}
              </p>
            </div>
          </div>

          {/* 3. QUICK ACTIONS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/ilan-ver"
              className="surface-card surface-card-hover p-4 rounded-xl border border-[var(--border-app)] flex flex-col items-center justify-center text-center gap-2 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center group-hover:scale-110 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[var(--text-main)]">Yeni İlan Oluştur</span>
            </Link>

            <button
              type="button"
              onClick={scrollToEditForm}
              className="surface-card surface-card-hover p-4 rounded-xl border border-[var(--border-app)] flex flex-col items-center justify-center text-center gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface-secondary)] text-[var(--text-main)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Edit className="w-5 h-5 text-[#FF8A1F]" />
              </div>
              <span className="text-xs font-bold text-[var(--text-main)]">Mağaza Profilini Düzenle</span>
            </button>

            <Link
              href="/hesabim/ilanlarim"
              className="surface-card surface-card-hover p-4 rounded-xl border border-[var(--border-app)] flex flex-col items-center justify-center text-center gap-2 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface-secondary)] text-[var(--text-main)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <ListPlus className="w-5 h-5 text-[var(--color-success)]" />
              </div>
              <span className="text-xs font-bold text-[var(--text-main)]">İlanları Yönet</span>
            </Link>

            <Link
              href="/hesabim/destek"
              className="surface-card surface-card-hover p-4 rounded-xl border border-[var(--border-app)] flex flex-col items-center justify-center text-center gap-2 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface-secondary)] text-[var(--text-main)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <LifeBuoy className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-[var(--text-main)]">Destek</span>
            </Link>
          </div>

          {/* 4. EDIT FORM SECTION */}
          <div ref={editFormRef} className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6">
            <div className="pb-4 border-b border-[var(--border-app)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-main)]">Kurumsal Vitrin Bilgileri</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Mağazanızı ziyaret eden GTA World oyuncularına gösterilecek şirket detayları.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6 max-w-2xl">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">Şirket / Galeri Adı</label>
                  <input
                    type="text"
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    required
                    className="form-input text-sm font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">Kısa Tanıtım / Açıklama</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="form-input text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Logo Görseli URL</label>
                    <input
                      type="text"
                      value={editLogoUrl}
                      onChange={(e) => setEditLogoUrl(e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Banner (Kapak) Görseli URL</label>
                    <input
                      type="text"
                      value={editBannerUrl}
                      onChange={(e) => setEditBannerUrl(e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Adres / Konum</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Vinewood Boulevard No: 12"
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">İletişim Telefonu</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="555-0192"
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Kurumsal SanMail</label>
                    <input
                      type="email"
                      value={editSanmail}
                      onChange={(e) => setEditSanmail(e.target.value)}
                      placeholder="galeri@sanmail.com"
                      className="form-input text-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="btn-primary py-2.5 px-6 text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Vitrin Bilgilerini Güncelle</span>
              </button>
            </form>
          </div>
        </div>
      ) : dealer?.status === 'PENDING' ? (
        /* PENDING STATUS CARD */
        <div className="p-8 rounded-2xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-center space-y-3 max-w-lg mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-base text-[var(--text-main)]">
            Kurumsal Başvurunuz İnceleniyor
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <strong className="text-[var(--text-main)]">{dealer.company_name}</strong> adına yaptığınız kurumsal vitrin başvurusu Sanboard yönetim ekibine iletilmiştir. Onaylandığında hesabınız otomatik olarak "Premium Satıcı" durumuna geçecektir.
          </p>
        </div>
      ) : (
        /* APPLICATION FORM FOR INDIVIDUAL USERS */
        <div className="max-w-xl space-y-6">
          <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#FF8A1F]">
              <Building2 className="w-4 h-4" />
              <span>Neden Kurumsal Satıcı Olmalısınız?</span>
            </div>
            <ul className="text-xs text-[var(--text-muted)] space-y-1 list-disc list-inside">
              <li>Özel kurumsal mağaza sayfası ve banner vitrini (`/magaza/şirket-adı`)</li>
              <li>İlanlarınızda dikkat çeken <strong>Premium Satıcı</strong> altın rozeti</li>
              <li>Tüm araç ve mülk portföyünüzün tek bir kurumsal sayfada toplanması</li>
            </ul>
          </div>

          <form onSubmit={handleApply} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Şirket / Galeri / Ofis Adı
              </label>
              <input
                type="text"
                placeholder="Örn: Rockford Prestige Motors veya Vespucci Emlak"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="form-input text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Profil Açma Amacı & Faaliyet Alanı
              </label>
              <textarea
                rows={4}
                placeholder="San Andreas'taki işletmenizin faaliyet alanını ve Sanboard kurumsal profilini ne amaçla kullanacağınızı kısaca belirtiniz..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                className="form-input text-sm resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="btn-primary py-3 px-6 text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Kurumsal Başvuruyu Gönder</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

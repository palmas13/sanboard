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
  Car,
  Home,
  BadgeCheck,
  UploadCloud,
  ImageIcon,
} from 'lucide-react';
import { DealerProfile } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';

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
  });
  const [storeListings, setStoreListings] = useState<any[]>([]);

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

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const fetchDealer = async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        fetch(`/api/dealers/profile?profileId=${currentProfile.id}`),
        fetch(`/api/dealers/listings?profileId=${currentProfile.id}`),
      ];

      const [dealerRes, listingsRes] = await Promise.all(promises);
      const data = await dealerRes.json();
      const listingsData = await listingsRes.json();

      if (data.dealer) {
        setDealer(data.dealer);
        setEditCompanyName(data.dealer.company_name);
        setEditDescription(data.dealer.description || '');
        setEditLogoUrl(data.dealer.logo_path || data.dealer.logo_url || '');
        setEditBannerUrl(data.dealer.banner_path || data.dealer.banner_url || '');
        setEditAddress(data.dealer.address || '');
        setEditPhone(data.dealer.phone || '');
        setEditSanmail(data.dealer.sanmail_email || data.dealer.email || '');
      } else {
        setDealer(null);
      }

      const listings = Array.isArray(listingsData.listings) ? listingsData.listings : [];
      setStoreListings(listings);

      const active = listings.filter((l: any) => l.status === 'ACTIVE');
      const vehicles = active.filter((l: any) => l.category === 'vehicle').length;
      const properties = active.filter((l: any) => l.category === 'property').length;

      setStats({
        activeListings: active.length,
        vehicleListings: vehicles,
        propertyListings: properties,
      });
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

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      setError('SVG formatı kabul edilmemektedir. Lütfen PNG, JPG, JPEG veya WEBP kullanınız.');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      setEditLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      setError('SVG formatı kabul edilmemektedir. Lütfen PNG, JPG, JPEG veya WEBP kullanınız.');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      setEditBannerUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      // Server will resolve dealer ownership directly from verified session
      const res = await fetch('/api/dealers/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

  const displayBanner = editBannerUrl.startsWith('data:image/')
    ? editBannerUrl
    : resolveMediaUrl(dealer?.banner_path || dealer?.banner_url);

  const displayLogo = editLogoUrl.startsWith('data:image/')
    ? editLogoUrl
    : resolveMediaUrl(dealer?.logo_path || dealer?.logo_url);

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
            {displayBanner ? (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
                style={{ backgroundImage: `url(${displayBanner})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-[#1a1208] to-[var(--bg-surface-secondary)] opacity-40 pointer-events-none" />
            )}
            {/* Gradient Overlay for Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/80 to-transparent pointer-events-none" />

            {/* Hero Content */}
            <div className="relative p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Logo */}
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#FF8A1F] bg-[var(--bg-surface)] shadow-lg shrink-0 flex items-center justify-center">
                  {displayLogo ? (
                    <img
                      src={displayLogo}
                      alt={dealer.company_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center text-2xl font-black">
                      {dealer.company_name?.charAt(0) || 'M'}
                    </div>
                  )}
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
                    {dealer.public_id && (
                      <span className="text-[10px] font-mono text-[var(--text-dim)] px-2 py-0.5 rounded bg-[var(--bg-surface-secondary)] border border-[var(--border-app)]">
                        #{dealer.public_id}
                      </span>
                    )}
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
                  href={`/premium/${dealer.public_id || dealer.id}`}
                  target="_blank"
                  className="btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 shadow-md flex-1 sm:flex-none"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mağazayı Görüntüle</span>
                </Link>
              </div>
            </div>
          </div>

          {/* 2. COMPACT STATS GRID (Item 10: Toplam Favori Removed) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>

          {/* 3. QUICK ACTIONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/ilan-ver?corporate=true"
              className="surface-card surface-card-hover p-4 rounded-xl border border-[#FF8A1F]/30 bg-gradient-to-r from-[var(--brand-orange-subtle)] to-transparent flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FF8A1F] text-black flex items-center justify-center group-hover:scale-105 transition-transform shadow-md shrink-0">
                <PlusCircle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">Yeni Mağaza İlanı</span>
                <span className="text-[11px] text-[var(--text-muted)]">Kurumsal vitrininize özel ilan yayınlayın</span>
              </div>
            </Link>

            <Link
              href={`/premium/${dealer.public_id || dealer.id}`}
              target="_blank"
              className="surface-card surface-card-hover p-4 rounded-xl border border-[var(--border-app)] flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-secondary)] text-[#FF8A1F] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <ExternalLink className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">Kamuya Açık Vitrin</span>
                <span className="text-[11px] text-[var(--text-muted)]">Oyuncuların gördüğü mağaza sayfasını aç</span>
              </div>
            </Link>
          </div>

          {/* 4. MAĞAZA ENVANTERİ (Corporate Store Inventory) */}
          <div className="surface-card p-6 sm:p-7 rounded-2xl border border-[var(--border-app)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div>
                <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                  <ListPlus className="w-4 h-4 text-[#FF8A1F]" />
                  <span>Mağaza Envanteri</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Yalnızca kurumsal mağazanıza ait ve kamuya açık vitrinde listelenen ilanlar.
                </p>
              </div>
              <Link
                href="/ilan-ver?corporate=true"
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>İlan Ekle</span>
              </Link>
            </div>

            {storeListings.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[var(--bg-surface-secondary)]/50 border border-dashed border-[var(--border-app)] space-y-2">
                <p className="text-xs text-[var(--text-muted)]">
                  Henüz mağazanıza ait kurumsal ilan bulunmuyor.
                </p>
                <Link
                  href="/ilan-ver?corporate=true"
                  className="inline-flex items-center gap-1 text-xs text-[#FF8A1F] hover:underline font-semibold"
                >
                  <span>İlk mağaza ilanınızı oluşturun ›</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {storeListings.map((l: any) => {
                  const cover = l.images?.find((img: any) => img.is_cover)?.storage_path || l.images?.[0]?.storage_path || l.cover_image;
                  const imgUrl = resolveMediaUrl(cover);
                  return (
                    <div
                      key={l.id}
                      className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/40 p-3 space-y-2 flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-lg bg-[var(--bg-surface)] overflow-hidden shrink-0 border border-[var(--border-app)] flex items-center justify-center">
                          {imgUrl ? (
                            <img src={imgUrl} alt={l.title} className="w-full h-full object-cover" />
                          ) : (
                            <Car className="w-5 h-5 text-[var(--text-dim)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-mono text-[var(--text-dim)] block">{l.listing_number}</span>
                          <h4 className="text-xs font-bold text-[var(--text-main)] truncate">{l.title}</h4>
                          <span className="text-xs font-extrabold text-[#FF8A1F]">${Number(l.price).toLocaleString('en-US')}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-[var(--border-app)] flex items-center justify-between text-[11px]">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                          {l.status === 'ACTIVE' ? 'Yayında' : l.status === 'SOLD' ? 'Satıldı' : l.status}
                        </span>
                        <div className="flex items-center gap-2">
                          <Link href={`/ilan/${l.id}`} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                            Görüntüle
                          </Link>
                          <Link href={`/hesabim/ilanlarim/${l.id}/duzenle`} className="text-[#FF8A1F] hover:underline font-medium">
                            Düzenle
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. EDIT FORM SECTION */}
          <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6">
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

                {/* LOGO & BANNER FILE UPLOAD (Item 9: NO URL TEXT INPUTS) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Mağaza Logosu</label>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-[var(--border-app)] bg-[var(--bg-surface)] shrink-0 flex items-center justify-center">
                        {displayLogo ? (
                          <img
                            src={displayLogo}
                            alt="Logo Önizleme"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-[var(--text-dim)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-[#FF8A1F]" />
                          <span>Logo Yükle</span>
                        </button>
                        <p className="text-[10px] text-[var(--text-dim)] mt-1">
                          PNG, JPG, WEBP (Max 512x512)
                        </p>
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Banner Upload */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Kapak Bannerı</label>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]">
                      <div className="w-20 h-14 rounded-xl overflow-hidden border border-[var(--border-app)] bg-[var(--bg-surface)] shrink-0 flex items-center justify-center">
                        {displayBanner ? (
                          <img
                            src={displayBanner}
                            alt="Banner Önizleme"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-[var(--text-dim)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => bannerInputRef.current?.click()}
                          className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-[#FF8A1F]" />
                          <span>Banner Yükle</span>
                        </button>
                        <p className="text-[10px] text-[var(--text-dim)] mt-1">
                          PNG, JPG, WEBP (Max 1600px)
                        </p>
                      </div>
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleBannerFileChange}
                        className="hidden"
                      />
                    </div>
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
                      className="form-input text-xs font-mono"
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

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary text-xs py-2.5 px-6 flex items-center gap-2 shadow-md cursor-pointer"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Değişiklikleri Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : dealer?.status === 'PENDING' ? (
        <div className="surface-card p-8 rounded-2xl border border-[var(--border-app)] text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-main)]">Başvurunuz İnceleniyor</h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            "{dealer.company_name}" adıyla yaptığınız kurumsal satıcı başvurusu yönetim ekibimiz tarafından değerlendirilmektedir. Onaylandığında bu sayfadan kurumsal vitrininizi yönetebilirsiniz.
          </p>
          <div className="pt-2">
            <Link href="/hesabim/destek" className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5">
              <span>Destek Talebi Aç</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6 max-w-2xl mx-auto">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-[var(--text-main)]">Kurumsal Satıcı Başvurusu</h2>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              San Andreas'ta galeri veya emlak işletmesiyseniz kurumsal mağaza profili açarak vitrininizi özelleştirebilirsiniz.
            </p>
          </div>

          <form onSubmit={handleApply} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Şirket / Galeri Adı</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Örn: Apex Motors, Vinewood Real Estate..."
                required
                className="form-input text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Faaliyet Amacı & Detaylar</label>
              <textarea
                rows={4}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="İşletmenizin rolü, Los Santos'taki konumu ve faaliyetleri hakkında kısa bilgi..."
                required
                className="form-input text-xs resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full btn-primary text-xs py-2.5 flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Başvuruyu Gönder</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

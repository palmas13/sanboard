'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getListingUrl } from '@/lib/urls';
import { SanboardImage } from '@/components/media/SanboardImage';
import {
  Building2,
  Crown,
  CheckCircle2,
  Clock,
  Save,
  AlertCircle,
  AlertTriangle,
  LifeBuoy,
  Loader2,
  ListPlus,
  Users,
  Calendar,
  BadgeCheck,
  UploadCloud,
  ImageIcon,
  Sparkles,
  Share2,
  RefreshCw,
  XCircle,
  Zap,
  Edit3,
  ArrowLeft,
  Trash2,
  Plus,
  CheckCircle,
  EllipsisVertical,
  Eye,
  Search,
} from 'lucide-react';
import { DealerProfile, Listing } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { formatCurrency, formatDate, formatTimeRemaining } from '@/lib/utils/format';
import { isListingActivelyFeatured } from '@/lib/listings/featured';
import { normalizeSocialMedia } from '@/lib/dealers/social';
import { readJsonResponse } from '@/lib/http/json-response';
import { canRenewCorporateSubscription, CORPORATE_PERIOD_BOOST_ALLOWANCE } from '@/lib/subscriptions/calendar-month';
type ListingTypeFilter = 'all' | 'vehicle' | 'property';
type ListingStatusFilter = 'all' | 'ACTIVE' | 'EXPIRED' | 'SOLD';

function getSubscriptionRemainingLabel(expiresAt?: string | null) {
  if (!expiresAt) return 'Aktif üyelik';
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Süresi doldu';
  const days = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  return `${days} gün kaldı`;
}

function getListingCover(listing: Listing) {
  const cover = listing.images?.find((image) => image.is_cover) || listing.images?.[0];
  return cover ? resolveMediaUrl(cover.storage_path) : '';
}

function getListingStatusPresentation(listing: Listing) {
  if (listing.status === 'SOLD') return { label: 'Satıldı', className: 'border-blue-400/20 bg-blue-400/10 text-blue-300' };
  if (listing.status === 'REMOVED') return { label: 'Yayından kaldırıldı', className: 'border-red-400/20 bg-red-400/10 text-red-300' };
  if (listing.status === 'EXPIRED' || formatTimeRemaining(listing.expires_at).isExpired) {
    return { label: 'Süresi doldu', className: 'border-amber-400/20 bg-amber-400/10 text-amber-300' };
  }
  return { label: 'Aktif', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' };
}

export default function HesabimKurumsalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const managedListingId = searchParams.get('listing');
  const { currentProfile } = useAuth();
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [application, setApplication] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Subview toggle: Editing vs Main Dashboard
  const [isEditingStore, setIsEditingStore] = useState(false);

  // Stats for approved dealers
  const [stats, setStats] = useState({
    activeListings: 0,
  });
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [storeListings, setStoreListings] = useState<Listing[]>([]);
  const [listingTypeFilter, setListingTypeFilter] = useState<ListingTypeFilter>('all');
  const [listingStatusFilter, setListingStatusFilter] = useState<ListingStatusFilter>('all');
  const [listingSearch, setListingSearch] = useState('');
  const [openListingMenuId, setOpenListingMenuId] = useState<string | null>(null);
  const [closeModalListing, setCloseModalListing] = useState<Listing | null>(null);
  const [closeReason, setCloseReason] = useState<'SOLD' | 'CANCELLED' | 'OTHER'>('SOLD');
  const [activeOfferCount, setActiveOfferCount] = useState(0);
  const [isProcessingClose, setIsProcessingClose] = useState(false);

  // Edit profile fields (for approved dealers)
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSanmail, setEditSanmail] = useState('');

  // Dynamic social media links (Sections 18-20: 1 initial, max 2 entries)
  const [socialLinks, setSocialLinks] = useState<Array<{ name: string; url: string }>>([
    { name: '', url: '' },
  ]);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const listingMenuRef = useRef<HTMLDivElement>(null);

  const isSubscriptionExpired = Boolean(
    dealer?.subscription_status === 'EXPIRED' ||
    (dealer?.subscription_expires_at ? new Date(dealer.subscription_expires_at) <= new Date() : false)
  );
  const canRenewSubscription = Boolean(dealer && canRenewCorporateSubscription(
    dealer.subscription_status,
    dealer.subscription_expires_at,
  ));
  const filteredListings = useMemo(() => {
    const normalizedSearch = listingSearch.trim().toLocaleLowerCase('tr-TR');
    return storeListings.filter((listing) => {
      const matchesType = listingTypeFilter === 'all' || listing.category === listingTypeFilter;
      const matchesStatus = listingStatusFilter === 'all' || listing.status === listingStatusFilter;
      const searchable = [listing.title, listing.subcategory, listing.listing_number]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      return matchesType && matchesStatus && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [listingSearch, listingStatusFilter, listingTypeFilter, storeListings]);

  useEffect(() => {
    if (!openListingMenuId) return;
    const closeMenu = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && listingMenuRef.current?.contains(event.target as Node)) return;
      setOpenListingMenuId(null);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
    };
  }, [openListingMenuId]);

  const handleCorporateCreateListing = async () => {
    if (!currentProfile) return;
    setActionLoading(true);
    setError('');
    try {
      // 1. Authoritative Server-Side Eligibility Verification (Section 7 & 8)
      const eligRes = await fetch('/api/dealers/eligibility');
      const eligData = await eligRes.json();
      if (!eligRes.ok || !eligData.eligible) {
        setError(eligData.message || 'Kurumsal mağazanız ilan vermeye uygun değil.');
        setActionLoading(false);
        return;
      }

      // 2. Check if user already has an available corporate credit
      const credRes = await fetch(`/api/credits?corporateProfileId=${encodeURIComponent(eligData.dealer.id)}`);
      const credData = await credRes.json();
      if (credData.scopedCorporateCredits && credData.scopedCorporateCredits > 0) {
        router.push('/ilan-ver/yeni?corporate=true');
        return;
      }

      // 3. Initiate corporate package checkout ($1.750, 14 days)
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `corporate-listing-credit:${eligData.dealer.id}:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          packageCode: 'CORPORATE_14_DAY',
        }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.error || 'Kurumsal sipariş oluşturulamadı.');
      window.location.assign(checkoutData.paymentLink);
    } catch (err: any) {
      setError(err.message || 'Kurumsal ilan verme işlemi başlatılamadı.');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchDealer = useCallback(async () => {
    if (!currentProfile?.id) return;
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        fetch('/api/dealers/profile'),
        fetch('/api/dealers/listings'),
        fetch('/api/dealers/apply'),
      ];

      const [dealerRes, listingsRes, applyRes] = await Promise.all(promises);
      const data = await dealerRes.json();
      const listingsData = await listingsRes.json();
      const applyData = await applyRes.json();

      if (applyData?.success && applyData.application) {
        setApplication(applyData.application);
      } else {
        setApplication(null);
      }

      if (data.dealer) {
        // If store is DELETED, do not show as active store; let owner see new application state (Section 2 C)
        if (data.dealer.moderation_status === 'DELETED' || data.dealer.deleted_at) {
          setDealer(null);
        } else {
          setDealer(data.dealer);
          setEditCompanyName(data.dealer.company_name);
          setEditDescription(data.dealer.description || '');
          setEditLogoUrl(data.dealer.logo_path || data.dealer.logo_url || '');
          setEditBannerUrl(data.dealer.banner_path || data.dealer.banner_url || '');
          setEditAddress(data.dealer.address || '');
          setEditPhone(data.dealer.phone || '');
          setEditSanmail(data.dealer.sanmail_email || data.dealer.email || '');

          // Normalize social media
          const normalized = normalizeSocialMedia(data.dealer.social_media);
          setSocialLinks(normalized.length > 0 ? normalized : [{ name: '', url: '' }]);

          // Fetch actual followers count
          try {
            const flwRes = await fetch(`/api/dealers/${data.dealer.id}/followers`);
            if (flwRes.ok) {
              const flwData = await flwRes.json();
              setFollowerCount(Array.isArray(flwData.followers) ? flwData.followers.length : 0);
            }
          } catch {
            // Ignore
          }
        }
      } else {
        setDealer(null);
      }

      const listings = Array.isArray(listingsData.listings) ? listingsData.listings : [];
      setStoreListings(listings);

      const active = listings.filter((l: any) => l.status === 'ACTIVE');
      setStats({
        activeListings: active.length,
      });
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [currentProfile?.id]);

  useEffect(() => {
    void fetchDealer();
  }, [fetchDealer]);

  const handleActivateSubscription = async () => {
    if (!dealer || !currentProfile) return;
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const activationRes = await fetch('/api/dealers/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerId: dealer.id }),
      });
      const activationData = await activationRes.json().catch(() => ({})) as {
        error?: string;
        testActivationBypass?: boolean;
      };

      if (activationRes.ok && activationData.testActivationBypass) {
        setSuccess('Test hesabı kurumsal üyeliği ödeme alınmadan aktif edildi.');
        await fetchDealer();
        return;
      }

      if (activationRes.status !== 409) {
        throw new Error(activationData.error || 'Üyelik aktivasyonu başlatılamadı.');
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `corporate-subscription:${dealer.id}:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ packageCode: 'CORPORATE_SUBSCRIPTION_30_DAY' }),
      });
      const data = await readJsonResponse<{ paymentLink: string }>(res, 'Kurumsal üyelik ödeme siparişi oluşturulamadı.');
      window.location.assign(data.paymentLink);
    } catch (err: any) {
      setError(err.message || 'Üyelik aktif edilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBoostListing = async (listingId: string) => {
    if (!dealer) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/dealers/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.code ? `${data.error || 'İlan öne çıkarılamadı.'} (${data.code})` : (data.error || 'İlan öne çıkarılamadı.'));

      if (data.paymentRequired && data.paymentLink) {
        window.location.assign(data.paymentLink);
        return;
      }
      setSuccess('İlan başarıyla 24 saatliğine en üst sıraya öne çıkarıldı.');
      await fetchDealer();
    } catch (err: any) {
      setError(err.message || 'Öne çıkarma başarısız.');
    } finally {
      setActionLoading(false);
    }
  };

  const openCloseListingModal = async (listing: Listing) => {
    setCloseReason('SOLD');
    setActiveOfferCount(0);
    setCloseModalListing(listing);
    const response = await fetch(`/api/offers?listingId=${encodeURIComponent(listing.id)}`);
    const data = await response.json().catch(() => ({}));
    setActiveOfferCount(response.ok ? Number(data.activeCount || 0) : 0);
  };

  const handleConfirmClose = async () => {
    if (!closeModalListing || !currentProfile) return;
    setIsProcessingClose(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/user/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: closeModalListing.id,
          action: closeReason === 'SOLD' ? 'SOLD' : 'REMOVED',
          closeReason,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'İlan kapatılamadı.');
      setCloseModalListing(null);
      setSuccess(closeReason === 'SOLD' ? 'İlan satıldı olarak kapatıldı.' : 'İlan yayından kaldırıldı.');
      await fetchDealer();
    } catch (err: any) {
      setError(err.message || 'İlan kapatılamadı.');
    } finally {
      setIsProcessingClose(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Lütfen geçerli bir görsel dosyası seçin (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo dosyası maksimum 2MB olabilir.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Lütfen geçerli bir görsel dosyası seçin (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Kapak görseli maksimum 4MB olabilir.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditBannerUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    // Filter valid non-empty social links (max 2)
    const validSocial = socialLinks
      .map((s) => ({ name: s.name.trim(), url: s.url.trim() }))
      .filter((s) => s.name.length > 0 && s.url.length > 0)
      .slice(0, 2);

    try {
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
          social_media: validSocial,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Güncellenemedi.');

      setSuccess('Kurumsal vitrin bilgileriniz ve sosyal medya bağlantılarınız başarıyla kaydedildi.');
      setIsEditingStore(false);
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
      ) : dealer?.moderation_status === 'SUSPENDED' ? (
        /* CASE SUSPENDED: STORE SUSPENDED BY ADMIN (Section 2 & 8) */
        <div className="surface-card p-8 rounded-2xl border border-amber-500/30 text-center space-y-5 max-w-lg mx-auto shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ASKIYA ALINDI
            </span>
            <h2 className="text-xl font-black text-[var(--text-main)]">
              Askıya alınmış geçmiş kurumsal profiliniz mevcut.
            </h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              &ldquo;{dealer.company_name}&rdquo; mağazanız yönetim tarafından askıya alınmıştır. Mağaza vitrininiz ve kurumsal ilanlarınız genel pazardan gizlenmiştir.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-left space-y-2.5">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block">
                Mağaza Adı
              </span>
              <p className="text-xs text-[var(--text-main)] font-semibold">{dealer.company_name}</p>
            </div>
            {dealer.suspended_at && (
              <div>
                <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block">
                  Askıya Alma Tarihi
                </span>
                <p className="text-xs text-[var(--text-main)]">{formatDate(dealer.suspended_at)}</p>
              </div>
            )}
            {dealer.suspension_reason && (
              <div>
                <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block">
                  Askıya Alma Nedeni
                </span>
                <p className="text-xs text-[var(--text-main)] font-medium text-amber-400/90">{dealer.suspension_reason}</p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Link
              href={`/hesabim/destek?subject=${encodeURIComponent('Kurumsal mağaza askı itirazı / yeniden değerlendirme')}`}
              className="btn-primary text-xs py-3 px-6 inline-flex items-center justify-center gap-2 shadow-md cursor-pointer w-full"
            >
              <LifeBuoy className="w-4 h-4" />
              <span>Destek Talebi Oluştur</span>
            </Link>
          </div>
        </div>
      ) : dealer?.status === 'APPROVED' && (dealer?.subscription_status === 'ACTIVE' || isSubscriptionExpired) ? (
        /* CASE 1: APPROVED STORE DASHBOARD (ACTIVE OR EXPIRED SUBSCRIPTION) */
        isEditingStore ? (
          /* SUBVIEW: EDITING VIEW (Section 13) */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsEditingStore(false)}
                className="btn-secondary text-xs py-2 px-3.5 inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 text-[#FF8A1F]" />
                <span>Mağazam Paneline Geri Dön</span>
              </button>
            </div>

            <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6">
              <div className="pb-4 border-b border-[var(--border-app)] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-main)]">Mağaza Bilgilerini Düzenle</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Mağazayı ziyaret eden GTA World oyuncularına gösterilecek şirket detayları ve sosyal medya bağlantıları.
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

                  {/* LOGO & BANNER FILE UPLOAD */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Mağaza Logosu</label>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]">
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[var(--border-app)] bg-[var(--bg-surface)] shrink-0 flex items-center justify-center">
                          {displayLogo ? (
                            <SanboardImage
                              src={displayLogo}
                              alt="Logo Önizleme"
                              fill
                              sizes="56px"
                              className="object-cover"
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
                          <p className="text-[10px] text-[var(--text-dim)] mt-1">PNG, JPG, WEBP (Max 512x512)</p>
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

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Kapak Bannerı</label>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]">
                        <div className="relative w-20 h-14 rounded-xl overflow-hidden border border-[var(--border-app)] bg-[var(--bg-surface)] shrink-0 flex items-center justify-center">
                          {displayBanner ? (
                            <SanboardImage
                              src={displayBanner}
                              alt="Banner Önizleme"
                              fill
                              sizes="80px"
                              className="object-cover"
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
                          <p className="text-[10px] text-[var(--text-dim)] mt-1">PNG, JPG, WEBP (Max 1600px)</p>
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

                  {/* DYNAMIC SOCIAL MEDIA FIELDS (Sections 18-20: 1 initial, max 2 entries) */}
                  <div className="pt-2 border-t border-[var(--border-app)] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-[#FF8A1F]" />
                        <span>Kurumsal Sosyal Medya Bağlantıları (Maksimum 2)</span>
                      </label>
                      <span className="text-[11px] text-[var(--text-dim)] font-mono">
                        {socialLinks.length}/2
                      </span>
                    </div>

                    <div className="space-y-3">
                      {socialLinks.map((link, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-40 shrink-0">
                            <input
                              type="text"
                              value={link.name}
                              onChange={(e) => {
                                const updated = [...socialLinks];
                                updated[idx].name = e.target.value;
                                setSocialLinks(updated);
                              }}
                              placeholder="Sosyal medya ismi"
                              className="form-input text-xs"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => {
                                const updated = [...socialLinks];
                                updated[idx].url = e.target.value;
                                setSocialLinks(updated);
                              }}
                              placeholder="https://lifeinvader.gtaw/..."
                              className="form-input text-xs"
                            />
                          </div>

                          {socialLinks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSocialLinks(socialLinks.filter((_, i) => i !== idx));
                              }}
                              className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 cursor-pointer transition-colors"
                              title="Bağlantıyı Kaldır"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      {socialLinks.length < 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (socialLinks.length < 2) {
                              setSocialLinks([...socialLinks, { name: '', url: '' }]);
                            }
                          }}
                          className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5 cursor-pointer text-[#FF8A1F]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Bir bağlantı daha ekle</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[var(--border-app)]">
                  <button
                    type="button"
                    onClick={() => setIsEditingStore(false)}
                    className="btn-secondary text-xs py-2.5 px-4"
                  >
                    Vazgeç
                  </button>

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
        ) : (
          /* MAIN MAĞAZAM DASHBOARD VIEW */
          <div className="space-y-6">
            {/* UPPER PREMIUM HERO CARD */}
            <div className="relative rounded-2xl overflow-hidden border border-[#FF8A1F]/30 bg-gradient-to-br from-[#1a1208] via-[var(--bg-surface)] to-[var(--bg-surface)] shadow-xl">
              {displayBanner ? (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
                  style={{ backgroundImage: `url(${displayBanner})` }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-[#1a1208] to-[var(--bg-surface-secondary)] opacity-40 pointer-events-none" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/80 to-transparent pointer-events-none" />

              <div className="relative p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 z-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#FF8A1F] bg-[var(--bg-surface)] shadow-lg shrink-0 flex items-center justify-center">
                    {displayLogo ? (
                      <SanboardImage
                        src={displayLogo}
                        alt={dealer.company_name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center text-2xl font-black">
                        {dealer.company_name?.charAt(0) || 'M'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] tracking-tight">
                        {dealer.company_name}
                      </h1>
                      {dealer.is_verified !== false && (
                        <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-label="Doğrulanmış kurumsal profil" />
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF9E45]">
                      <Crown className="h-3 w-3" />
                      Premium Satıcı
                    </span>

                    <p className="text-xs text-[var(--text-muted)] max-w-xl line-clamp-2">
                      {dealer.description || 'Los Santos kurumsal vitrin sayfası ve lisanslı işletme.'}
                    </p>
                  </div>
                </div>

                {/* Header Action: Kurumsal İlan Ver & Mağaza Bilgilerini Düzenle */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleCorporateCreateListing}
                    disabled={actionLoading || isSubscriptionExpired}
                    className="btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 shadow-md flex-1 sm:flex-none cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Kurumsal İlan Ver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingStore(true)}
                    className="btn-secondary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 shadow-md flex-1 sm:flex-none cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Mağaza Bilgilerini Düzenle</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Subscription Expired Alert */}
            {canRenewSubscription && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{isSubscriptionExpired
                    ? 'Kurumsal üyelik süreniz sona ermiştir. Yeni kurumsal ilan veremez ve öne çıkarma yapamazsınız.'
                    : 'Kurumsal üyeliğinizin bitmesine 7 gün veya daha az kaldı. Üyeliğinizi mevcut bitiş tarihinden itibaren uzatabilirsiniz.'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleActivateSubscription}
                  disabled={actionLoading}
                  className="btn-primary text-xs py-1.5 px-3 shrink-0"
                >
                  Üyeliği Yenile
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="surface-card rounded-xl border border-[var(--border-app)] p-4 transition-colors hover:border-[#FF8A1F]/25">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="text-xs font-semibold">Aktif İlan</span>
                  <ListPlus className="w-4 h-4 text-[var(--color-success)]" />
                </div>
                <p className="mt-2 text-3xl font-black tabular-nums text-[var(--text-main)]">{stats.activeListings}</p>
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">Şu anda yayında</p>
              </div>

              <div className="surface-card rounded-xl border border-[var(--border-app)] p-4 transition-colors hover:border-[#FF8A1F]/25">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="text-xs font-semibold">Toplam Takipçi</span>
                  <Users className="w-4 h-4 text-[#FF8A1F]" />
                </div>
                <p className="mt-2 text-3xl font-black tabular-nums text-[var(--text-main)]">{followerCount}</p>
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">Mağazanızı takip edenler</p>
              </div>

              <div className="surface-card rounded-xl border border-[var(--border-app)] p-4 transition-colors hover:border-[#FF8A1F]/25">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="text-xs font-semibold">Kalan Öne Çıkarma</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <p className="mt-2 text-3xl font-black tabular-nums text-[var(--text-main)]">
                  {dealer.boost_credits ?? 0}<span className="ml-1 text-base font-bold text-[var(--text-dim)]">/ {CORPORATE_PERIOD_BOOST_ALLOWANCE}</span>
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">Mevcut üyelik döneminde</p>
              </div>

              <div className="surface-card rounded-xl border border-[var(--border-app)] p-4 transition-colors hover:border-[#FF8A1F]/25">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="text-xs font-semibold">Üyelik</span>
                  <Calendar className="w-4 h-4 text-[#FF8A1F]" />
                </div>
                <p className="mt-2 text-lg font-black text-[var(--text-main)]">
                  {getSubscriptionRemainingLabel(dealer.subscription_expires_at)}
                </p>
                <p className="mt-1 truncate text-[11px] text-[var(--text-dim)]">
                  {dealer.subscription_expires_at ? formatDate(dealer.subscription_expires_at) : 'Bitiş tarihi bulunmuyor'}
                </p>
              </div>
            </div>

            <div id="ilanlar" className="surface-card scroll-mt-24 space-y-5 rounded-2xl border border-[var(--border-app)] p-4 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-[var(--border-app)] pb-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-[var(--text-main)]">Kurumsal İlanlar</h2>
                      <span className="text-xs font-bold text-[#FF9E45]">{stats.activeListings} aktif</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Mağaza vitrininizi yönetin, ilan durumlarını hızlıca takip edin.</p>
                  </div>
                  <label className="relative block w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      type="search"
                      value={listingSearch}
                      onChange={(event) => setListingSearch(event.target.value)}
                      placeholder="İlanlarda ara"
                      aria-label="Kurumsal ilanlarda ara"
                      className="form-input h-10 w-full pl-9 text-xs"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="İlan türü filtresi">
                    {([['all', 'Tümü'], ['vehicle', 'Araç'], ['property', 'Mülk']] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setListingTypeFilter(value)} className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors ${listingTypeFilter === value ? 'border-[#FF8A1F]/40 bg-[var(--brand-orange-subtle)] text-[#FF9E45]' : 'border-[var(--border-app)] text-[var(--text-muted)] hover:border-[var(--border-app-hover)] hover:text-[var(--text-main)]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="İlan durumu filtresi">
                    {([['all', 'Tümü'], ['ACTIVE', 'Aktif'], ['EXPIRED', 'Süresi Dolan'], ['SOLD', 'Satılan']] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setListingStatusFilter(value)} className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors ${listingStatusFilter === value ? 'border-[#FF8A1F]/40 bg-[var(--brand-orange-subtle)] text-[#FF9E45]' : 'border-[var(--border-app)] text-[var(--text-muted)] hover:border-[var(--border-app-hover)] hover:text-[var(--text-main)]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {storeListings.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-dim)] flex items-center justify-center">
                    <ListPlus className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Mağazanıza ait henüz yayında bir kurumsal ilan bulunmuyor.
                  </p>
                  <button
                    type="button"
                    onClick={handleCorporateCreateListing}
                    disabled={actionLoading || isSubscriptionExpired}
                    className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Kurumsal İlan Ver</span>
                  </button>
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-app)] py-10 text-center">
                  <Search className="mx-auto h-5 w-5 text-[var(--text-dim)]" />
                  <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">Bu filtrelerle eşleşen ilan bulunamadı.</p>
                  <button type="button" onClick={() => { setListingSearch(''); setListingTypeFilter('all'); setListingStatusFilter('all'); }} className="mt-3 text-xs font-bold text-[#FF9E45] hover:text-[#FFB46E]">
                    Filtreleri temizle
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredListings.map((l) => {
                    const isBoosted = isListingActivelyFeatured(l);
                    const remaining = formatTimeRemaining(l.expires_at);
                    const coverImage = getListingCover(l);
                    const status = getListingStatusPresentation(l);
                    const canManageActiveListing = l.status === 'ACTIVE' && !remaining.isExpired;
                    const boostDisabledReason = isSubscriptionExpired
                      ? 'Abonelik süreniz dolduğu için boost kullanılamaz'
                      : !canManageActiveListing
                        ? 'Yalnızca yayındaki ilanlar öne çıkarılabilir'
                        : (dealer.boost_credits ?? 0) <= 0
                          ? 'Kalan öne çıkarma hakkınız bulunmuyor'
                          : '';
                    return (
                      <div
                        key={l.id}
                        data-testid="corporate-listing-card"
                        className={`group relative rounded-xl border bg-[var(--bg-surface-secondary)]/35 p-3 transition-colors hover:border-[#FF8A1F]/30 hover:bg-[var(--bg-surface-secondary)]/60 ${managedListingId === l.id ? 'border-[#FF8A1F]/40 ring-1 ring-[#FF8A1F]/20' : 'border-[var(--border-app)]'}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] sm:h-24 sm:w-36 sm:aspect-auto lg:h-28 lg:w-44">
                            {coverImage ? (
                              <Image
                                src={coverImage}
                                alt={l.title}
                                fill
                                sizes="(max-width: 639px) calc(100vw - 4rem), (max-width: 1023px) 144px, 176px"
                                className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[var(--text-dim)]">
                                <ImageIcon className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 py-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="min-w-0 text-sm font-bold leading-snug text-[var(--text-main)] sm:text-base">{l.title}</h3>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${status.className}`}>{status.label}</span>
                              {isBoosted && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black text-amber-300" title={l.featured_until ? `Bitiş: ${formatDate(l.featured_until)}` : undefined}>
                                  <Sparkles className="h-2.5 w-2.5" />
                                  Aktif Boost{l.featured_until ? ` · ${formatTimeRemaining(l.featured_until).text}` : ''}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-lg font-black tracking-tight text-[#FF9E45]">{formatCurrency(l.price)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
                              <span>{l.category === 'vehicle' ? 'Araç' : 'Mülk'}</span>
                              <span aria-hidden="true">•</span>
                              <span>{l.subcategory}</span>
                              {l.status === 'ACTIVE' && (
                                <>
                                  <span aria-hidden="true">•</span>
                                  <span className={`inline-flex items-center gap-1 font-semibold ${remaining.isExpired ? 'text-amber-300' : 'text-emerald-300'}`}><Clock className="h-3 w-3" />{remaining.text}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border-app)] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                            <Link href={getListingUrl(l)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#FF8A1F]/30 bg-[var(--brand-orange-subtle)] px-3 text-xs font-bold text-[#FF9E45] transition-colors hover:border-[#FF8A1F]/50 hover:bg-[#FF8A1F]/15">
                              <Eye className="h-3.5 w-3.5" />
                              İlanı Gör
                            </Link>
                            <div className="relative" ref={openListingMenuId === l.id ? listingMenuRef : undefined}>
                              <button type="button" onClick={() => setOpenListingMenuId((current) => current === l.id ? null : l.id)} aria-label={`${l.title} yönetim menüsü`} aria-haspopup="menu" aria-expanded={openListingMenuId === l.id} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-app)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-app-hover)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]">
                                <EllipsisVertical className="h-4 w-4" />
                              </button>
                              {openListingMenuId === l.id && (
                                <div role="menu" className="absolute bottom-full right-0 z-30 mb-2 w-52 overflow-hidden rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.4)] sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2">
                                  {canManageActiveListing && (
                                    <Link role="menuitem" href={`/hesabim/ilanlarim/${l.id}/duzenle`} onClick={() => setOpenListingMenuId(null)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)]">
                                      <Edit3 className="h-3.5 w-3.5" />İlanı Düzenle
                                    </Link>
                                  )}
                                  {!isBoosted && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => { setOpenListingMenuId(null); void handleBoostListing(l.id); }}
                                      disabled={actionLoading || Boolean(boostDisabledReason)}
                                      title={boostDisabledReason || '24 saatliğine öne çıkar'}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Zap className="h-3.5 w-3.5" />Öne Çıkar
                                    </button>
                                  )}
                                  {canManageActiveListing && (
                                    <>
                                      <div className="my-1 border-t border-[var(--border-app)]" />
                                      <button type="button" role="menuitem" onClick={() => { setOpenListingMenuId(null); void openCloseListingModal(l); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-300 transition-colors hover:bg-red-400/10">
                                        <XCircle className="h-3.5 w-3.5" />İlanı Kapat
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )
      ) : dealer?.status === 'APPROVED' ? (
        /* CASE 2: APPROVED BUT SUBSCRIPTION INACTIVE OR EXPIRED */
        <div className="surface-card mx-auto max-w-2xl overflow-hidden rounded-3xl border border-[#FF8A1F]/25 shadow-[0_24px_80px_rgba(0,0,0,.22)]">
          <div className="border-b border-[var(--border-app)] bg-gradient-to-br from-[#FF8A1F]/10 via-transparent to-transparent p-6 sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              <span>Başvurunuz Onaylandı</span>
            </span>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.025em] text-[var(--text-main)] sm:text-3xl">Kurumsal Üyeliğinizi Aktifleştirin</h2>
            <p className="mt-2 text-sm font-semibold text-[#FF9E45]">{dealer.company_name} Kurumsal Paket</p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
              Kurumsal mağaza başvurunuz onaylandı. Aşağıdaki ödeme ile üyeliğinizi aktifleştirerek mağaza avantajlarını kullanabilirsiniz.
            </p>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/55 p-4 sm:p-5">
              <h3 className="text-sm font-bold text-[var(--text-main)]">Kurumsal Paket Avantajları</h3>
              <ul className="mt-4 space-y-3 text-xs leading-5 text-[var(--text-muted)] sm:text-sm">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span><strong className="text-[var(--text-main)]">İndirimli ilan:</strong> İlan başına $1.750.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span><strong className="text-[var(--text-main)]">14 gün yayın:</strong> İlanlarınız daha uzun süre yayında kalır.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span><strong className="text-[var(--text-main)]">3 öne çıkarma hakkı:</strong> Her 30 günlük dönemde 24 saatlik boost.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span><strong className="text-[var(--text-main)]">Mağaza vitrini:</strong> Logo, banner, sosyal medya ve özel mağaza adresi.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span><strong className="text-[var(--text-main)]">Takipçi sistemi:</strong> Yeni ilanlarınız takipçilerinize ulaşır.</span>
              </li>
              </ul>
            </div>

            <div>
              <button type="button" onClick={handleActivateSubscription} disabled={actionLoading} className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2 py-3.5 text-sm shadow-lg">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                <span>Kurumsal Üyeliği Aktifleştir</span>
              </button>
              <p className="mt-2 text-center text-[11px] text-[var(--text-dim)]">Ödeme Fleeca üzerinden tamamlanacaktır.</p>
            </div>
          </div>
        </div>
      ) : dealer?.status === 'PENDING' || application?.status === 'PENDING' ? (
        /* CASE 3: PENDING */
        <div className="surface-card p-8 rounded-2xl border border-[var(--border-app)] text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-main)]">Kurumsal Başvurunuz İnceleniyor</h2>
          <div className="p-4 rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30 text-xs font-semibold leading-relaxed">
            Kurumsal hesap talebiniz yönetim ekibi tarafından incelenmektedir. Bu işlem 24–48 saat arası sürebilmektedir.
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            &ldquo;{application?.company_name || dealer?.company_name}&rdquo; adıyla yaptığınız başvuru kaydı sistemimizde güvenle saklanmaktadır. Başvuru sonucunuz karakterinize bildirim olarak iletilecektir.
          </p>
        </div>
      ) : dealer?.status === 'REJECTED' || application?.status === 'REJECTED' ? (
        /* CASE 4: REJECTED */
        <div className="surface-card p-8 rounded-2xl border border-red-500/30 text-center space-y-5 max-w-lg mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
              REDDEDİLDİ
            </span>
            <h2 className="text-lg font-bold text-[var(--text-main)]">Başvurunuz Reddedildi</h2>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-left space-y-1.5">
            <span className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider block">
              Reddedilme Nedeni:
            </span>
            <p className="text-xs text-[var(--text-main)] font-medium">
              {application?.rejection_reason || 'Fiziksel işletme bilgileri doğrulanamadığı için başvurunuz reddedildi.'}
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/hesabim/kurumsal/basvuru"
              className="btn-primary text-xs py-2.5 px-6 inline-flex items-center gap-2 shadow-md cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tekrar Başvuru Yap</span>
            </Link>
          </div>
        </div>
      ) : (
        /* CASE 5: NEW APPLICATION */
        <div className="surface-card p-8 rounded-2xl border border-[var(--border-app)] space-y-5 max-w-2xl mx-auto text-center">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-[var(--text-main)]">Kurumsal Satıcı Başvurusu</h2>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Los Santos'ta fiziksel bir işletme (galeri veya emlak acentesi) işletiyorsanız Sanboard kurumsal mağazası için başvurabilirsiniz.
            </p>
          </div>

          <Link href="/hesabim/kurumsal/basvuru" className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs"><Building2 className="h-4 w-4" />Başvuruyu Başlat</Link>
        </div>
      )}
      {closeModalListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="corporate-close-listing-title">
          <div className="surface-card w-full max-w-md rounded-2xl border border-[var(--border-app)] p-6 shadow-2xl space-y-4">
            <div>
              <h3 id="corporate-close-listing-title" className="text-lg font-bold text-[var(--text-main)]">İlanı Kapat</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Satıldı seçeneği ilanı hemen yayından kaldırır ve 24 saat sonra temizleme için uygun hale getirir. Diğer seçenekler kalıcı kaldırma işini hemen başlatır.</p>
            </div>
            <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-3 text-xs font-semibold text-[var(--text-main)] truncate">
              {closeModalListing.title}
            </div>
            {activeOfferCount > 0 && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300">Bu ilan için {activeOfferCount} aktif teklif bulunuyor. İlan kapatıldığında bu tekliflerin tamamı da kapatılacak.</p>
            )}
            <div className="grid gap-2">
              {([
                ['SOLD', 'Satıldı'],
                ['CANCELLED', 'Satıştan vazgeçildi'],
                ['OTHER', 'Diğer nedenle kapat'],
              ] as const).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-3 text-xs font-semibold text-[var(--text-main)]">
                  <input type="radio" name="corporateCloseReason" value={value} checked={closeReason === value} onChange={() => setCloseReason(value)} className="accent-[#FF8A1F]" />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2.5 border-t border-[var(--border-app)] pt-4">
              <button type="button" onClick={() => setCloseModalListing(null)} disabled={isProcessingClose} className="btn-secondary px-4 py-2 text-xs">Vazgeç</button>
              <button type="button" onClick={handleConfirmClose} disabled={isProcessingClose} className="btn-danger flex items-center gap-1.5 px-4 py-2 text-xs">
                {isProcessingClose ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                <span>İlanı Kapat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

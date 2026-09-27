'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getListingUrl } from '@/lib/urls';
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
  ExternalLink,
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
} from 'lucide-react';
import { DealerProfile } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { formatDate } from '@/lib/utils/format';
import { normalizeSocialMedia } from '@/lib/dealers/social';
import { readJsonResponse } from '@/lib/http/json-response';

export default function HesabimKurumsalPage() {
  const router = useRouter();
  const { currentProfile } = useAuth();
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [application, setApplication] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isReapplying, setIsReapplying] = useState(false);

  // Subview toggle: Editing vs Main Dashboard
  const [isEditingStore, setIsEditingStore] = useState(false);

  // Stats for approved dealers
  const [stats, setStats] = useState({
    activeListings: 0,
  });
  const [followerCount, setFollowerCount] = useState<number>(0);
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

  // Dynamic social media links (Sections 18-20: 1 initial, max 2 entries)
  const [socialLinks, setSocialLinks] = useState<Array<{ name: string; url: string }>>([
    { name: '', url: '' },
  ]);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const isSubscriptionExpired = Boolean(
    dealer?.subscription_status === 'EXPIRED' ||
    (dealer?.subscription_expires_at ? new Date(dealer.subscription_expires_at) <= new Date() : false)
  );

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
      const credRes = await fetch('/api/credits');
      const credData = await credRes.json();
      if (credData.corporateCredits && credData.corporateCredits > 0) {
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
      router.push(`/odeme/${checkoutData.orderId}`);
    } catch (err: any) {
      setError(err.message || 'Kurumsal ilan verme işlemi başlatılamadı.');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchDealer = async () => {
    if (!currentProfile) return;
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
          companyName: companyName.trim(),
          company_name: companyName.trim(),
          purpose: purpose.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Başvuru gönderilemedi.');

      setSuccess('Kurumsal başvurunuz başarıyla alındı. Yönetim onayından sonra aktif edilecektir.');
      setIsReapplying(false);
      await fetchDealer();
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateSubscription = async () => {
    if (!dealer || !currentProfile) return;
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `corporate-subscription:${dealer.id}:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ packageCode: 'CORPORATE_SUBSCRIPTION_30_DAY' }),
      });
      const data = await readJsonResponse<{ orderId: string }>(res, 'Kurumsal üyelik ödeme siparişi oluşturulamadı.');
      router.push(`/odeme/${data.orderId}`);
    } catch (err: any) {
      setError(err.message || 'Üyelik aktif edilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBoostListing = async (listingId: string) => {
    if (!dealer || (dealer.boost_credits ?? 0) <= 0) {
      setError('Yetersiz öne çıkarma hakkı.');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/dealers/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerId: dealer.id, listingId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İlan öne çıkarılamadı.');

      setSuccess('İlan başarıyla 24 saatliğine en üst sıraya öne çıkarıldı.');
      await fetchDealer();
    } catch (err: any) {
      setError(err.message || 'Öne çıkarma başarısız.');
    } finally {
      setActionLoading(false);
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
                    </div>

                    {/* Section 36: No visible #ID near company name */}
                    <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] tracking-tight">
                      {dealer.company_name}
                    </h1>

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
            {isSubscriptionExpired && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Kurumsal üyelik süreniz sona ermiştir. Yeni kurumsal ilan veremez ve öne çıkarma yapamazsınız.</span>
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

            {/* COMPACT STATS GRID (Section 14: Aktif İlan, Toplam Takipçi, Kalan Öne Çıkarma Hakkı, Üyelik Bitiş Tarihi) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-1">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="text-xs font-semibold">Aktif İlan</span>
                  <ListPlus className="w-4 h-4 text-[var(--color-success)]" />
                </div>
                <p className="text-2xl font-black text-[var(--text-main)]">{stats.activeListings}</p>
              </div>

              <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-1">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="text-xs font-semibold">Toplam Takipçi</span>
                  <Users className="w-4 h-4 text-[#FF8A1F]" />
                </div>
                <p className="text-2xl font-black text-[var(--text-main)]">{followerCount}</p>
              </div>

              <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-1">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="text-xs font-semibold">Kalan Öne Çıkarma</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-2xl font-black text-[var(--text-main)]">{dealer.boost_credits ?? 0}/3</p>
              </div>

              <div className="surface-card p-4 rounded-xl border border-[var(--border-app)] space-y-1">
                <div className="flex items-center justify-between text-[var(--text-muted)]">
                  <span className="text-xs font-semibold">Üyelik Bitiş Tarihi</span>
                  <Calendar className="w-4 h-4 text-[#FF8A1F]" />
                </div>
                <p className="text-sm font-extrabold text-[var(--text-main)] truncate mt-1">
                  {dealer.subscription_expires_at ? formatDate(dealer.subscription_expires_at) : 'Aktif'}
                </p>
              </div>
            </div>

            {/* STORE INVENTORY (İlan Yönetimi & Boost) */}
            <div className="surface-card p-6 sm:p-7 rounded-2xl border border-[var(--border-app)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">Kurumsal İlan Envanteri</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Mağazanıza kayıtlı aktif ilanlar ve 24 saatlik öne çıkarma (boost) yönetimi.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#FF8A1F] bg-[var(--brand-orange-subtle)] px-2.5 py-1 rounded-full border border-[#FF8A1F]/20">
                  {storeListings.length} Toplam İlan
                </span>
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
              ) : (
                <div className="divide-y divide-[var(--border-app)]">
                  {storeListings.map((l: any) => {
                    const isBoosted = l.is_featured;
                    return (
                      <div
                        key={l.id}
                        className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] overflow-hidden shrink-0">
                            {l.cover_image ? (
                              <img
                                src={resolveMediaUrl(l.cover_image)}
                                alt={l.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[var(--text-dim)]">
                                <ListPlus className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[var(--text-main)] truncate max-w-xs sm:max-w-md">
                                {l.title}
                              </span>
                              {isBoosted && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-500 to-[#FF8A1F] text-white">
                                  <Sparkles className="w-2.5 h-2.5 fill-current" />
                                  ÖNE ÇIKARILDI
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                              <span className="font-bold text-[#FF8A1F]">${l.price?.toLocaleString('tr-TR')}</span>
                              <span>•</span>
                              <span>{l.category === 'vehicle' ? 'Araç' : 'Mülk'}</span>
                              <span>•</span>
                              <span>Bitiş: {formatDate(l.expires_at)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 text-xs">
                          {isBoosted ? (
                            <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-bold">
                              Aktif Boost
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBoostListing(l.id)}
                              disabled={actionLoading || isSubscriptionExpired || (dealer.boost_credits ?? 0) <= 0}
                              className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 text-amber-400 hover:border-amber-400/40 cursor-pointer disabled:opacity-50"
                              title={
                                isSubscriptionExpired
                                  ? 'Abonelik süreniz dolduğu için boost kullanılamaz'
                                  : (dealer.boost_credits ?? 0) <= 0
                                  ? 'Kalan öne çıkarma hakkınız bulunmuyor'
                                  : '24 saatliğine öne çıkar'
                              }
                            >
                              <Zap className="w-3 h-3" />
                              <span>Öne Çıkar</span>
                            </button>
                          )}

                          <Link href={getListingUrl(l)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                            Gör
                          </Link>
                          <Link href={`/hesabim/ilanlarim/${l.id}/duzenle`} className="text-[#FF8A1F] hover:underline font-medium">
                            Düzenle
                          </Link>
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
        <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[#FF8A1F]/30 max-w-xl mx-auto space-y-6 text-center shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
            <Crown className="w-7 h-7 fill-current" />
          </div>

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BadgeCheck className="w-4 h-4" />
              <span>Başvurunuz Onaylandı</span>
            </span>
            <h2 className="text-xl font-black text-[var(--text-main)]">
              {dealer.company_name} Kurumsal Paket
            </h2>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Kurumsal mağaza başvurunuz onaylanmıştır. Kurumsal mağaza avantajlarından yararlanmak için üyeliğinizi aktif edin.
            </p>
          </div>

          {/* Package details */}
          <div className="p-5 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-left space-y-3">
            <h4 className="text-xs font-bold text-[#FF8A1F] uppercase tracking-wider">Kurumsal Paket Avantajları</h4>
            <ul className="text-xs text-[var(--text-main)] space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>İndirimli İlan Ücreti:</strong> İlan başı $1.750 (Bireysel $2.000 yerine)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>2 Kat Daha Uzun Süre:</strong> 14 gün yayında kalma süresi (Bireysel 7 gün yerine)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Öne Çıkarma (Boost):</strong> Her 30 günlük dönemde 3 adet 24 saatlik öne çıkarma hakkı</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Kamuya Açık Mağaza Vitrini:</strong> Özel logo, banner, sosyal medya ve /premium URL</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Takipçi Sistemi:</strong> Oyuncular mağazanızı takip edebilir ve yeni ilanlarınızdan anında haberdar olur</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleActivateSubscription}
            disabled={actionLoading}
            className="w-full btn-primary text-xs py-3 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>Üyeliği Aktif Et (Fleeca ile Öde)</span>
          </button>
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
      ) : !isReapplying && (dealer?.status === 'REJECTED' || application?.status === 'REJECTED') ? (
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
            <button
              type="button"
              onClick={() => {
                setCompanyName(application?.company_name || '');
                setPurpose('');
                setIsReapplying(true);
              }}
              className="btn-primary text-xs py-2.5 px-6 inline-flex items-center gap-2 shadow-md cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tekrar Başvuru Yap</span>
            </button>
          </div>
        </div>
      ) : (
        /* CASE 5: NEW APPLICATION FORM */
        <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6 max-w-2xl mx-auto">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-[var(--text-main)]">Kurumsal Satıcı Başvurusu</h2>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Los Santos'ta fiziksel bir işletme (galeri veya emlak acentesi) işletiyorsanız Sanboard kurumsal mağazası için başvurabilirsiniz.
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

            <div className="pt-2 flex items-center justify-between gap-3">
              {isReapplying && (
                <button
                  type="button"
                  onClick={() => setIsReapplying(false)}
                  className="btn-secondary text-xs py-2.5 px-4"
                >
                  Geri
                </button>
              )}
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 btn-primary text-xs py-2.5 flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Building2 className="w-4 h-4" />
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

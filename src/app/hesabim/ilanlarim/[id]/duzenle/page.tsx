'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Car,
  Home,
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PhotoUploader, UploadedImage } from '@/components/forms/PhotoUploader';
import { formatCurrency, formatTimeRemaining } from '@/lib/utils/format';
import { getVehicleBrands, getModelsByBrand } from '@/lib/constants/vehicleCatalog';

const TITLE_MAX = 60;
const DESC_MAX = 100;

export default function IlanDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentProfile, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [listingData, setListingData] = useState<any>(null);

  // Form Fields
  const [category, setCategory] = useState<'vehicle' | 'property'>('vehicle');
  const [subcategory, setSubcategory] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');

  // Vehicle Details
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [mileage, setMileage] = useState('');
  const [engineUpgrade, setEngineUpgrade] = useState('0');
  const [transmissionUpgrade, setTransmissionUpgrade] = useState('0');
  const [brakeUpgrade, setBrakeUpgrade] = useState('0');
  const [turbo, setTurbo] = useState(false);
  const [subwoofer, setSubwoofer] = useState(false);
  const [tradeAvailable, setTradeAvailable] = useState(false);

  // Property Details
  const [floor, setFloor] = useState('1');
  const [roomCount, setRoomCount] = useState('2+1');
  const [furnished, setFurnished] = useState(false);
  const [buildingType, setBuildingType] = useState('Normal');
  const [balcony, setBalcony] = useState(false);

  // Photos
  const [images, setImages] = useState<UploadedImage[]>([]);

  const vehicleBrands = React.useMemo(() => getVehicleBrands(), []);
  const availableModels = React.useMemo(() => getModelsByBrand(brand), [brand]);

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    setModel('');
  };

  useEffect(() => {
    if (!isAuthenticated || !currentProfile) return;

    async function loadListing() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/user/listings/${id}?profileId=${currentProfile?.id}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'İlan yüklenemedi.');
        }

        const l = data.listing;
        setListingData(l);
        setCategory(l.category);
        setSubcategory(l.subcategory);
        setTitle(l.title);
        setDescription(l.description);
        setPrice(String(l.price));
        setLocation(l.location || '');
        setImages(l.images || []);

        if (l.category === 'vehicle' && l.vehicle_details) {
          const vd = l.vehicle_details;
          setBrand(vd.brand || '');
          setModel(vd.model || '');
          setPlate(vd.plate || '');
          setMileage(String(vd.mileage ?? ''));
          setEngineUpgrade(String(vd.engine_upgrade ?? '0'));
          setTransmissionUpgrade(String(vd.transmission_upgrade ?? '0'));
          setBrakeUpgrade(String(vd.brake_upgrade ?? '0'));
          setTurbo(Boolean(vd.turbo));
          setSubwoofer(Boolean(vd.subwoofer));
          setTradeAvailable(Boolean(vd.trade_available));
        }

        if (l.category === 'property' && l.property_details) {
          const pd = l.property_details;
          setFloor(String(pd.floor ?? '1'));
          setRoomCount(pd.room_count || '2+1');
          setFurnished(Boolean(pd.furnished));
          setBuildingType(pd.building_type || 'Normal');
          setBalcony(Boolean(pd.balcony));
        }
      } catch (err: any) {
        setError(err.message || 'İlan bilgileri getirilemedi.');
      } finally {
        setLoading(false);
      }
    }

    loadListing();
  }, [id, currentProfile, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    setError('');

    // Validation
    if (!title.trim() || title.length > TITLE_MAX) {
      setError(`İlan başlığı 1-${TITLE_MAX} karakter arasında olmalıdır.`);
      return;
    }
    if (description.length > DESC_MAX) {
      setError(`İlan açıklaması en fazla ${DESC_MAX} karakter olabilir.`);
      return;
    }
    if (!price || Number(price) <= 0) {
      setError('Geçerli bir fiyat giriniz.');
      return;
    }
    if (images.length === 0) {
      setError('En az 1 adet fotoğraf yüklemelisiniz.');
      return;
    }

    if (category === 'vehicle') {
      if (!brand) {
        setError('Lütfen araç markasını seçiniz.');
        return;
      }
      if (!model) {
        setError('Lütfen araç modelini seçiniz.');
        return;
      }
      if (!plate.trim()) {
        setError('Araç plakası zorunludur.');
        return;
      }
      if (mileage === '' || Number(mileage) < 0) {
        setError('Geçerli bir kilometre giriniz.');
        return;
      }
    }

    if (category === 'property') {
      if (!location.trim()) {
        setError('Mülk konumu zorunludur.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload: any = {
        profileId: currentProfile.id,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        subcategory,
        images,
      };

      if (category === 'vehicle') {
        payload.vehicle_category = subcategory;
        payload.brand = brand;
        payload.model = model;
        payload.plate = plate.trim().toUpperCase();
        payload.mileage = Number(mileage);
        payload.engine_upgrade = Number(engineUpgrade);
        payload.transmission_upgrade = Number(transmissionUpgrade);
        payload.brake_upgrade = Number(brakeUpgrade);
        payload.turbo = turbo;
        payload.subwoofer = subwoofer;
        payload.trade_available = tradeAvailable;
      } else {
        payload.location = location.trim();
        payload.property_type = subcategory;
        payload.floor = Number(floor);
        payload.room_count = roomCount;
        payload.furnished = furnished;
        payload.building_type = buildingType;
        payload.balcony = balcony;
      }

      const res = await fetch(`/api/user/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'İlan güncellenemedi.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/hesabim/ilanlarim');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="surface-card p-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-app)]">
        <Loader2 className="w-5 h-5 animate-spin text-[#FF8A1F]" />
        <span>İlan bilgileri yükleniyor...</span>
      </div>
    );
  }

  if (error && !listingData) {
    return (
      <div className="surface-card p-8 rounded-2xl border border-[var(--color-danger)]/30 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)] flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-main)]">İlan Düzenlenemiyor</h2>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">{error}</p>
        <Link href="/hesabim/ilanlarim" className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span>İlanlarıma Dön</span>
        </Link>
      </div>
    );
  }

  const remaining = formatTimeRemaining(listingData?.expires_at);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="surface-card p-5 sm:p-6 rounded-2xl border border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/hesabim/ilanlarim"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>İlanlarıma Dön</span>
            </Link>
            <span className="text-[var(--text-dim)]">•</span>
            <span className="badge-tag text-[10px] font-mono">{listingData?.listing_number}</span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
            {category === 'vehicle' ? <Car className="w-5 h-5 text-[#FF8A1F]" /> : <Home className="w-5 h-5 text-[#FF8A1F]" />}
            <span>İlanı Düzenle</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            İlan düzenlemek ücretsizdir, yeni hak tüketmez ve ilan sürenizi değiştirmez.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs bg-[var(--bg-surface-secondary)] px-3.5 py-2 rounded-xl border border-[var(--border-app)]">
          <Clock className="w-4 h-4 text-[#FF8A1F]" />
          <div>
            <span className="text-[var(--text-dim)]">Kalan Süre: </span>
            <span className="font-bold text-[var(--color-success)]">{remaining.text}</span>
          </div>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-2 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>İlan başarıyla güncellendi! İlanlarım sayfasına yönlendiriliyorsunuz...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2 border border-[rgba(229,72,77,0.3)]">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-8">
        {/* TEMEL BİLGİLER */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--border-app)] pb-2">
            1. Temel Bilgiler
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs font-semibold text-[var(--text-muted)]">İlan Başlığı</label>
                <span className="text-[11px] text-[var(--text-dim)]">{title.length}/{TITLE_MAX}</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                required
                className="form-input text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs font-semibold text-[var(--text-muted)]">İlan Açıklaması</label>
                <span className="text-[11px] text-[var(--text-dim)]">{description.length}/{DESC_MAX}</span>
              </div>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                className="form-input text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Fiyat ($)</label>
                <input
                  type="number"
                  min="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="form-input text-sm font-bold text-[#FF8A1F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  {category === 'vehicle' ? 'Araç Kategorisi' : 'Mülk Türü'}
                </label>
                {category === 'vehicle' ? (
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="form-select text-sm"
                  >
                    <option value="Otomobil">Otomobil</option>
                    <option value="SUV / Off-Road / Kamyonet">SUV / Off-Road / Kamyonet</option>
                    <option value="Motosiklet">Motosiklet</option>
                  </select>
                ) : (
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="form-select text-sm"
                  >
                    <option value="Ev / Daire">Ev / Daire</option>
                    <option value="İşyeri">İşyeri</option>
                    <option value="Diğer Mülk">Diğer Mülk</option>
                  </select>
                )}
              </div>
            </div>

            {/* MÜLK İÇİN KONUM (Araç ilanlarında konum bulunmaz!) */}
            {category === 'property' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Konum / Bölge</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Örn: Vinewood Hills, Rockford Plaza..."
                  required
                  className="form-input text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* TEKNİK DETAYLAR */}
        {category === 'vehicle' ? (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--border-app)] pb-2">
              2. Araç Detayları
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Marka */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Marka</label>
                <select
                  value={brand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  required
                  className="form-select text-sm"
                >
                  <option value="">Marka Seçiniz</option>
                  {vehicleBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={!brand}
                  required
                  className="form-select text-sm disabled:opacity-50"
                >
                  <option value="">{brand ? 'Model Seçiniz' : 'Önce Marka Seçiniz'}</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plaka */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Plaka</label>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  required
                  className="form-input text-sm uppercase font-mono font-bold"
                />
              </div>

              {/* Kilometre */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Kilometre</label>
                <input
                  type="number"
                  min="0"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  required
                  className="form-input text-sm"
                />
              </div>
            </div>

            {/* Performans & Donanım */}
            <div className="pt-2 space-y-3">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Performans Geliştirmeleri (0 - 4)</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-dim)]">Motor</span>
                  <select
                    value={engineUpgrade}
                    onChange={(e) => setEngineUpgrade(e.target.value)}
                    className="form-select text-xs"
                  >
                    {[0, 1, 2, 3, 4].map((lvl) => (
                      <option key={lvl} value={lvl}>Seviye {lvl}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-dim)]">Şanzıman</span>
                  <select
                    value={transmissionUpgrade}
                    onChange={(e) => setTransmissionUpgrade(e.target.value)}
                    className="form-select text-xs"
                  >
                    {[0, 1, 2, 3, 4].map((lvl) => (
                      <option key={lvl} value={lvl}>Seviye {lvl}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-dim)]">Fren</span>
                  <select
                    value={brakeUpgrade}
                    onChange={(e) => setBrakeUpgrade(e.target.value)}
                    className="form-select text-xs"
                  >
                    {[0, 1, 2, 3, 4].map((lvl) => (
                      <option key={lvl} value={lvl}>Seviye {lvl}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Ek Donanımlar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={turbo}
                  onChange={(e) => setTurbo(e.target.checked)}
                  className="rounded border-[var(--border-app)] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                />
                <span className="text-xs font-semibold text-[var(--text-main)]">Turbo Şarj</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={subwoofer}
                  onChange={(e) => setSubwoofer(e.target.checked)}
                  className="rounded border-[var(--border-app)] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                />
                <span className="text-xs font-semibold text-[var(--text-main)]">Subwoofer Ses</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={tradeAvailable}
                  onChange={(e) => setTradeAvailable(e.target.checked)}
                  className="rounded border-[var(--border-app)] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                />
                <span className="text-xs font-semibold text-[var(--text-main)]">Takasa Açık</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--border-app)] pb-2">
              2. Mülk Detayları
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Kat</label>
                <input
                  type="number"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="form-input text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Oda Sayısı</label>
                <select
                  value={roomCount}
                  onChange={(e) => setRoomCount(e.target.value)}
                  className="form-select text-sm"
                >
                  <option value="Stüdyo">Stüdyo</option>
                  <option value="1+0">1+0</option>
                  <option value="1+1">1+1</option>
                  <option value="2+1">2+1</option>
                  <option value="3+1">3+1</option>
                  <option value="4+1">4+1</option>
                  <option value="5+1+">5+1+</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Yapı Tipi</label>
                <select
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                  className="form-select text-sm"
                >
                  <option value="Normal">Normal</option>
                  <option value="Dubleks">Dubleks</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={furnished}
                  onChange={(e) => setFurnished(e.target.checked)}
                  className="rounded border-[var(--border-app)] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                />
                <span className="text-xs font-semibold text-[var(--text-main)]">Eşyalı</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={balcony}
                  onChange={(e) => setBalcony(e.target.checked)}
                  className="rounded border-[var(--border-app)] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                />
                <span className="text-xs font-semibold text-[var(--text-main)]">Balkonlu</span>
              </label>
            </div>
          </div>
        )}

        {/* FOTOĞRAFLAR */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--border-app)] pb-2">
            3. Fotoğraflar
          </h3>
          <PhotoUploader images={images} onChange={setImages} />
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-4 border-t border-[var(--border-app)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/hesabim/ilanlarim"
            className="btn-secondary text-xs py-2.5 px-4 w-full sm:w-auto text-center"
          >
            İptal
          </Link>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-xs py-2.5 px-6 w-full sm:w-auto flex items-center justify-center gap-2 shadow-md cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Değişiklikleri Kaydet</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

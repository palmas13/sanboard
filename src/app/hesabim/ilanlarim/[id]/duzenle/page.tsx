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
import { CustomSelect } from '@/components/ui/CustomSelect';
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
  const { user, currentProfile, isAuthenticated } = useAuth();

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
  const [lockLevel, setLockLevel] = useState('');
  const [alarmLevel, setAlarmLevel] = useState('');
  const [antiTheftLevel, setAntiTheftLevel] = useState('');
  const [engineHealth, setEngineHealth] = useState('');
  const [suspension, setSuspension] = useState('');
  const [fuelType, setFuelType] = useState<string>('BENZIN');
  const [factoryPrice, setFactoryPrice] = useState('');

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

  const handleSubcategoryChange = (newSub: string) => {
    if (newSub !== subcategory) {
      setSubcategory(newSub);
      if (category === 'vehicle') {
        // Reset brand and model when category changes (e.g. Otomobil -> Motosiklet)
        setBrand('');
        setModel('');
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !currentProfile?.id) return;
    // Do not re-fetch and overwrite in-progress edits if already loaded
    if (listingData && listingData.id === id) return;

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
          setLockLevel(vd.lock_level !== null && vd.lock_level !== undefined ? String(vd.lock_level) : '');
          setAlarmLevel(vd.alarm_level !== null && vd.alarm_level !== undefined ? String(vd.alarm_level) : '');
          setAntiTheftLevel(vd.anti_theft_level !== null && vd.anti_theft_level !== undefined ? String(vd.anti_theft_level) : '');
          setEngineHealth(vd.engine_health !== null && vd.engine_health !== undefined ? String(vd.engine_health) : '');
          setSuspension(vd.suspension || '');
          setFuelType(vd.fuel_type || 'BENZIN');
          setFactoryPrice(vd.factory_price !== null && vd.factory_price !== undefined ? String(vd.factory_price) : '');
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
  }, [id, currentProfile?.id, isAuthenticated, listingData]);

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
        userId: user?.id,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        subcategory,
        images,
      };

      if (category === 'vehicle') {
        if (engineHealth !== '' && (Number(engineHealth) < 0 || Number(engineHealth) > 100)) {
          setError('Motor sağlığı %0 ile %100 arasında olmalıdır.');
          return;
        }
        if (lockLevel !== '' && Number(lockLevel) < 0) {
          setError('Kilit seviyesi 0 veya daha büyük olmalıdır.');
          return;
        }
        if (alarmLevel !== '' && Number(alarmLevel) < 0) {
          setError('Alarm seviyesi 0 veya daha büyük olmalıdır.');
          return;
        }
        if (antiTheftLevel !== '' && Number(antiTheftLevel) < 0) {
          setError('Hırsızlık önleme seviyesi 0 veya daha büyük olmalıdır.');
          return;
        }
        if (factoryPrice !== '' && Number(factoryPrice) < 0) {
          setError('Fabrika çıkış fiyatı 0 veya daha büyük olmalıdır.');
          return;
        }

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
        payload.lock_level = lockLevel !== '' ? Number(lockLevel) : null;
        payload.alarm_level = alarmLevel !== '' ? Number(alarmLevel) : null;
        payload.anti_theft_level = antiTheftLevel !== '' ? Number(antiTheftLevel) : null;
        payload.engine_health = engineHealth !== '' ? Number(engineHealth) : null;
        payload.suspension = suspension.trim() || null;
        payload.fuel_type = fuelType || null;
        payload.factory_price = factoryPrice !== '' ? Number(factoryPrice) : null;
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
                <CustomSelect
                  value={subcategory}
                  onChange={handleSubcategoryChange}
                  options={
                    category === 'vehicle'
                      ? [
                          { value: 'Otomobil', label: 'Otomobil' },
                          { value: 'SUV / Off-Road / Kamyonet', label: 'SUV / Off-Road / Kamyonet' },
                          { value: 'Motosiklet', label: 'Motosiklet' },
                        ]
                      : [
                          { value: 'Ev / Daire', label: 'Ev / Daire' },
                          { value: 'İşyeri', label: 'İşyeri' },
                          { value: 'Diğer Mülk', label: 'Diğer Mülk' },
                        ]
                  }
                />
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
                <CustomSelect
                  value={brand}
                  onChange={handleBrandChange}
                  placeholder="Marka Seçiniz"
                  options={vehicleBrands.map((b) => ({ value: b, label: b }))}
                />
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Model</label>
                <CustomSelect
                  value={model}
                  onChange={(v) => setModel(v)}
                  disabled={!brand}
                  placeholder={brand ? 'Model Seçiniz' : 'Önce Marka Seçiniz'}
                  options={availableModels.map((m) => ({ value: m, label: m }))}
                />
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

            {/* MEKANİK */}
            <div className="pt-2 space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Mekanik & Performans</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-dim)] font-medium">Motor Geliştirmesi</span>
                  <CustomSelect
                    value={engineUpgrade}
                    onChange={(v) => setEngineUpgrade(v)}
                    options={[
                      { value: '0', label: 'Seviye 0' },
                      { value: '1', label: 'Seviye 1' },
                      { value: '2', label: 'Seviye 2' },
                      { value: '3', label: 'Seviye 3' },
                      { value: '4', label: 'Seviye 4' },
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-dim)] font-medium">Şanzıman Geliştirmesi</span>
                  <CustomSelect
                    value={transmissionUpgrade}
                    onChange={(v) => setTransmissionUpgrade(v)}
                    options={[
                      { value: '0', label: 'Seviye 0' },
                      { value: '1', label: 'Seviye 1' },
                      { value: '2', label: 'Seviye 2' },
                      { value: '3', label: 'Seviye 3' },
                      { value: '4', label: 'Seviye 4' },
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-dim)] font-medium">Fren Geliştirmesi</span>
                  <CustomSelect
                    value={brakeUpgrade}
                    onChange={(v) => setBrakeUpgrade(v)}
                    options={[
                      { value: '0', label: 'Seviye 0' },
                      { value: '1', label: 'Seviye 1' },
                      { value: '2', label: 'Seviye 2' },
                      { value: '3', label: 'Seviye 3' },
                      { value: '4', label: 'Seviye 4' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">Motor Sağlığı (%0 - 100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={engineHealth}
                    onChange={(e) => setEngineHealth(e.target.value)}
                    placeholder="Örn: 100"
                    className="form-input text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">Süspansiyon</label>
                  <input
                    type="text"
                    value={suspension}
                    onChange={(e) => setSuspension(e.target.value)}
                    placeholder="Örn: Stok, Spor, Yarış..."
                    className="form-input text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">Yakıt Türü</label>
                  <CustomSelect
                    value={fuelType}
                    onChange={(v) => setFuelType(v)}
                    options={[
                      { value: 'BENZIN', label: 'Benzin' },
                      { value: 'DIZEL', label: 'Dizel' },
                      { value: 'ELEKTRIK', label: 'Elektrik' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* GÜVENLİK */}
            <div className="pt-2 space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Güvenlik Seviyeleri</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">Kilit Seviyesi</label>
                  <input
                    type="number"
                    min="0"
                    value={lockLevel}
                    onChange={(e) => setLockLevel(e.target.value)}
                    placeholder="Örn: 2"
                    className="form-input text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">Alarm Seviyesi</label>
                  <input
                    type="number"
                    min="0"
                    value={alarmLevel}
                    onChange={(e) => setAlarmLevel(e.target.value)}
                    placeholder="Örn: 1"
                    className="form-input text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">Hırsızlık Önleme Seviyesi</label>
                  <input
                    type="number"
                    min="0"
                    value={antiTheftLevel}
                    onChange={(e) => setAntiTheftLevel(e.target.value)}
                    placeholder="Örn: 3"
                    className="form-input text-sm"
                  />
                </div>
              </div>
            </div>

            {/* EK DONANIM & SATIŞ */}
            <div className="pt-2 space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Ek Donanım & Satış</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

              <div className="space-y-1.5 pt-2 max-w-sm">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Fabrika Çıkış Fiyatı ($)</label>
                <input
                  type="number"
                  min="0"
                  value={factoryPrice}
                  onChange={(e) => setFactoryPrice(e.target.value)}
                  placeholder="Örn: 85000"
                  className="form-input text-sm"
                />
              </div>
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
                <CustomSelect
                  value={roomCount}
                  onChange={(v) => setRoomCount(v)}
                  options={[
                    { value: 'Stüdyo', label: 'Stüdyo' },
                    { value: '1+0', label: '1+0' },
                    { value: '1+1', label: '1+1' },
                    { value: '2+1', label: '2+1' },
                    { value: '3+1', label: '3+1' },
                    { value: '4+1', label: '4+1' },
                    { value: '5+1+', label: '5+1+' },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Yapı Tipi</label>
                <CustomSelect
                  value={buildingType}
                  onChange={(v) => setBuildingType(v)}
                  options={[
                    { value: 'Normal', label: 'Normal' },
                    { value: 'Dubleks', label: 'Dubleks' },
                  ]}
                />
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

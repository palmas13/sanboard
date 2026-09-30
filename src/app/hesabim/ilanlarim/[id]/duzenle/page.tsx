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
} from 'lucide-react';
import { PhotoUploader, UploadedImage } from '@/components/forms/PhotoUploader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { formatTimeRemaining } from '@/lib/utils/format';
import { readJsonResponse } from '@/lib/http/json-response';
import { getVehicleBrandsByCategory, getVehicleModels, isMotorcycleCategory, isValidVehicleSelection, reconcileVehicleSelection, VEHICLE_CATEGORIES, VehicleCategory } from '@/lib/constants/vehicleCategories';
import { LISTING_DESCRIPTION_MAX_LENGTH, LISTING_TITLE_MAX_ERROR, LISTING_TITLE_MAX_LENGTH } from '@/lib/validations/listing';
import { getVehicleLevelOptions, normalizeVehicleLevel, VEHICLE_LEVEL_FIELDS } from '@/lib/listings/vehicle-levels';
import { formatTurkishInteger, isIntegerInRange, normalizeIntegerInput, normalizeTurkishIntegerInput } from '@/lib/forms/integer-input';
import { toListingImageReferences } from '@/lib/listings/image-references';

const TITLE_MAX = LISTING_TITLE_MAX_LENGTH;
const DESC_MAX = LISTING_DESCRIPTION_MAX_LENGTH;

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
  const [offersEnabled, setOffersEnabled] = useState(true);
  const [minimumOffer, setMinimumOffer] = useState('');
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
  const [marketValue, setMarketValue] = useState('');
  const [furnitureValue, setFurnitureValue] = useState('');
  const [buildingType, setBuildingType] = useState('Normal');
  const [balcony, setBalcony] = useState(false);

  // Photos
  const [images, setImages] = useState<UploadedImage[]>([]);

  const vehicleCategory = subcategory as VehicleCategory;
  const vehicleBrands = React.useMemo(() => getVehicleBrandsByCategory(vehicleCategory), [vehicleCategory]);
  const availableModels = React.useMemo(() => getVehicleModels(vehicleCategory, brand), [vehicleCategory, brand]);

  const updateInteger = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const normalized = normalizeIntegerInput(value);
    if (normalized !== null) setter(normalized);
  };

  const updateMoney = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const normalized = normalizeTurkishIntegerInput(value);
    if (normalized !== null) setter(normalized);
  };

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    setModel('');
  };

  const handleSubcategoryChange = (newSub: string) => {
    if (newSub !== subcategory) {
      setSubcategory(newSub);
      if (category === 'vehicle') {
        const next = reconcileVehicleSelection(newSub as VehicleCategory, brand, model);
        setBrand(next.brand);
        setModel(next.model);
        if (isMotorcycleCategory(newSub as VehicleCategory)) setSuspension('');
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
        const res = await fetch(`/api/user/listings/${id}`);
        const data = await readJsonResponse<{ listing: any }>(res, 'İlan yüklenemedi.');

        const l = data.listing;
        setListingData(l);
        setCategory(l.category);
        setSubcategory(l.subcategory);
        setTitle(l.title);
        setDescription(l.description);
        setPrice(normalizeTurkishIntegerInput(String(l.price)) || '');
        setOffersEnabled(l.offers_enabled !== false);
        setMinimumOffer(l.minimum_offer_amount ? normalizeTurkishIntegerInput(String(l.minimum_offer_amount)) || '' : '');
        setLocation(l.location || '');
        setImages(l.images || []);

        if (l.category === 'vehicle' && l.vehicle_details) {
          const vd = l.vehicle_details;
          setBrand(vd.brand || '');
          setModel(vd.model || '');
          setPlate(vd.plate || '');
          setMileage(normalizeIntegerInput(String(vd.mileage ?? '')) || '');
          setEngineUpgrade(normalizeVehicleLevel(vd.engine_upgrade, 'engine_upgrade'));
          setTransmissionUpgrade(normalizeVehicleLevel(vd.transmission_upgrade, 'transmission_upgrade'));
          setBrakeUpgrade(normalizeVehicleLevel(vd.brake_upgrade, 'brake_upgrade'));
          setTurbo(Boolean(vd.turbo));
          setSubwoofer(Boolean(vd.subwoofer));
          setTradeAvailable(Boolean(vd.trade_available));
          setLockLevel(normalizeVehicleLevel(vd.lock_level, 'lock_level'));
          setAlarmLevel(normalizeVehicleLevel(vd.alarm_level, 'alarm_level'));
          setAntiTheftLevel(normalizeVehicleLevel(vd.anti_theft_level, 'anti_theft_level'));
          setEngineHealth(vd.engine_health !== null && vd.engine_health !== undefined ? normalizeIntegerInput(String(vd.engine_health)) || '' : '');
          setSuspension(isMotorcycleCategory(l.subcategory as VehicleCategory) ? '' : normalizeVehicleLevel(vd.suspension, 'suspension'));
          setFuelType(vd.fuel_type || 'BENZIN');
          setFactoryPrice(vd.factory_price !== null && vd.factory_price !== undefined ? normalizeTurkishIntegerInput(String(vd.factory_price)) || '' : '');
        }

        if (l.category === 'property' && l.property_details) {
          const pd = l.property_details;
          setFloor(String(pd.floor ?? '1'));
          setRoomCount(pd.room_count || '2+1');
          setFurnished(Boolean(pd.furnished));
          setMarketValue(pd.market_value != null ? normalizeTurkishIntegerInput(String(pd.market_value)) || '' : '');
          setFurnitureValue(pd.furniture_value != null ? normalizeTurkishIntegerInput(String(pd.furniture_value)) || '' : '');
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
      setError(title.trim() ? LISTING_TITLE_MAX_ERROR : 'İlan başlığı zorunludur.');
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
    if (minimumOffer !== '' && (Number(minimumOffer) <= 0 || Number(minimumOffer) > Number(price))) {
      setError('Minimum teklif 0’dan büyük ve satış fiyatından yüksek olmamalıdır.');
      return;
    }
    if (images.length === 0) {
      setError('En az 1 adet fotoğraf yüklemelisiniz.');
      return;
    }
    if (images.length > (category === 'property' ? 5 : 3)) {
      setError(`${category === 'property' ? 'Mülk' : 'Araç'} ilanlarında en fazla ${category === 'property' ? 5 : 3} fotoğraf kullanılabilir.`);
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
      if (!isValidVehicleSelection(vehicleCategory, brand, model)) {
        setError('Lütfen kategoriyle uyumlu geçerli bir marka ve model seçiniz.');
        return;
      }
      if (!plate.trim()) {
        setError('Araç plakası zorunludur.');
        return;
      }
      if (mileage === '' || !isIntegerInRange(mileage, 0, Number.MAX_SAFE_INTEGER)) {
        setError('Kilometre 0 veya daha büyük bir tam sayı olmalıdır.');
        return;
      }
    }

    if (category === 'property') {
      if (!location.trim()) {
        setError('Mülk konumu zorunludur.');
        return;
      }
      if (!isIntegerInRange(marketValue, 1, 1_000_000_000)) {
        setError('Market değeri 0’dan büyük bir tam sayı olmalıdır.');
        return;
      }
      if (furnished && !isIntegerInRange(furnitureValue, 1, 1_000_000_000)) {
        setError('Eşyalı mülklerde eşya bedeli 0’dan büyük bir tam sayı olmalıdır.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload: any = {
        profileId: currentProfile.id,
        userId: user?.id,
        category,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        offers_enabled: offersEnabled,
        minimum_offer_amount: offersEnabled && minimumOffer !== '' ? Number(minimumOffer) : null,
        subcategory,
        images: toListingImageReferences(images),
      };

      if (category === 'vehicle') {
        if (engineHealth !== '' && !isIntegerInRange(engineHealth, 0, 100)) {
          setError('Motor sağlığı %0 ile %100 arasında bir tam sayı olmalıdır.');
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
        if (factoryPrice !== '' && !isIntegerInRange(factoryPrice, 1, 1_000_000_000)) {
          setError('Fabrika çıkış fiyatı 0’dan büyük bir tam sayı olmalıdır.');
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
        payload.lock_level = Number(lockLevel);
        payload.alarm_level = Number(alarmLevel);
        payload.anti_theft_level = Number(antiTheftLevel);
        payload.engine_health = engineHealth !== '' ? Number(engineHealth) : null;
        payload.suspension = isMotorcycleCategory(vehicleCategory) ? null : (suspension !== '' ? Number(suspension) : null);
        payload.fuel_type = fuelType || null;
        payload.factory_price = factoryPrice !== '' ? Number(factoryPrice) : null;
      } else {
        payload.location = location.trim();
        payload.property_type = subcategory;
        payload.floor = Number(floor);
        payload.room_count = roomCount;
        payload.furnished = furnished;
        payload.market_value = Number(marketValue);
        payload.furniture_value = furnished ? Number(furnitureValue) : null;
        payload.building_type = buildingType;
        payload.balcony = balcony;
      }

      const res = await fetch(`/api/user/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      await readJsonResponse<{ success: boolean; listing: any }>(res, 'İlan güncellenemedi.');

      setSuccess(true);
      setTimeout(() => {
        router.push(listingData?.seller_type === 'CORPORATE' ? '/hesabim/kurumsal' : '/hesabim/ilanlarim');
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

  const returnHref = listingData?.seller_type === 'CORPORATE' ? '/hesabim/kurumsal' : '/hesabim/ilanlarim';
  const returnLabel = listingData?.seller_type === 'CORPORATE' ? 'Kurumsal İlanlara Dön' : 'İlanlarıma Dön';

  if (error && !listingData) {
    return (
      <div className="surface-card p-8 rounded-2xl border border-[var(--color-danger)]/30 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)] flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-main)]">İlan Düzenlenemiyor</h2>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">{error}</p>
        <Link href={returnHref} className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span>{returnLabel}</span>
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
              href={returnHref}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{returnLabel}</span>
            </Link>
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
            <span className={`font-bold ${remaining.isExpired ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>{remaining.text}</span>
          </div>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-2 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>İlan başarıyla güncellendi! İlan yönetimine yönlendiriliyorsunuz...</span>
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
                <span className={`text-[11px] ${title.length >= TITLE_MAX - 5 ? 'text-amber-400' : 'text-[var(--text-dim)]'}`}>{title.length} / {TITLE_MAX}</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={Math.max(TITLE_MAX, title.length)}
                required
                className="form-input text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs font-semibold text-[var(--text-muted)]">İlan Açıklaması</label>
                <span className={`text-[11px] ${description.length > DESC_MAX ? 'font-semibold text-[var(--color-danger)]' : 'text-[var(--text-dim)]'}`}>
                  {description.length}/{DESC_MAX}
                </span>
              </div>
              <textarea
                rows={3}
                value={description}
                maxLength={DESC_MAX}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input text-sm resize-none"
              />
            </div>

            <div className={`grid grid-cols-1 gap-4 ${category === 'property' ? 'sm:grid-cols-2' : ''}`}>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Fiyat ($)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatTurkishInteger(price)}
                  onChange={(e) => updateMoney(e.target.value, setPrice)}
                  required
                  className="form-input text-sm font-bold text-[#FF8A1F]"
                />
              </div>

              {category === 'property' && <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Mülk Türü
                </label>
                <CustomSelect
                  value={subcategory}
                  onChange={handleSubcategoryChange}
                  options={[
                    { value: 'Ev / Daire', label: 'Ev / Daire' },
                    { value: 'İşyeri', label: 'İşyeri' },
                    { value: 'Diğer Mülk', label: 'Diğer Mülk' },
                  ]}
                />
              </div>}
            </div>
            <div className="space-y-3 rounded-xl border border-[var(--border-app)] p-4">
              <label className="flex items-center justify-between gap-4 text-xs font-semibold text-[var(--text-muted)]"><span><b className="block text-[var(--text-main)]">Tekliflere Açık</b>Fiyat pazarlığını aç veya kapat.</span><input type="checkbox" checked={offersEnabled} onChange={(e)=>setOffersEnabled(e.target.checked)} className="h-5 w-5 accent-[#FF8A1F]" /></label>
              {offersEnabled&&<label className="block text-xs font-semibold text-[var(--text-muted)]">Minimum Teklif (opsiyonel)<input type="text" inputMode="numeric" value={formatTurkishInteger(minimumOffer)} onChange={(e)=>updateMoney(e.target.value, setMinimumOffer)} className="form-input mt-2" /></label>}
            </div>

            {/* MÜLK İÇİN KONUM (Araç ilanlarında konum bulunmaz!) */}
            {category === 'property' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Konum / Bölge</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Araç Kategorisi</label>
              <CustomSelect value={subcategory} onChange={handleSubcategoryChange} options={VEHICLE_CATEGORIES.map((value) => ({ value, label: value }))} />
            </div>

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
                  type="text"
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) => updateInteger(e.target.value, setMileage)}
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
                  <span className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.engine_upgrade.label}</span>
                  <CustomSelect
                    value={engineUpgrade}
                    onChange={(v) => setEngineUpgrade(v)}
                    options={getVehicleLevelOptions('engine_upgrade')}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.transmission_upgrade.label}</span>
                  <CustomSelect
                    value={transmissionUpgrade}
                    onChange={(v) => setTransmissionUpgrade(v)}
                    options={getVehicleLevelOptions('transmission_upgrade')}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.brake_upgrade.label}</span>
                  <CustomSelect
                    value={brakeUpgrade}
                    onChange={(v) => setBrakeUpgrade(v)}
                    options={getVehicleLevelOptions('brake_upgrade')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">Motor Sağlığı (%0 - 100)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={engineHealth}
                    onChange={(e) => updateInteger(e.target.value, setEngineHealth)}
                    className="form-input text-sm"
                  />
                </div>
                {!isMotorcycleCategory(vehicleCategory) && <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.suspension.label}</label>
                  <CustomSelect
                    value={suspension}
                    onChange={setSuspension}
                    options={getVehicleLevelOptions('suspension')}
                  />
                </div>}
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
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.lock_level.label}</label>
                  <CustomSelect
                    value={lockLevel}
                    onChange={setLockLevel}
                    options={getVehicleLevelOptions('lock_level')}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.alarm_level.label}</label>
                  <CustomSelect
                    value={alarmLevel}
                    onChange={setAlarmLevel}
                    options={getVehicleLevelOptions('alarm_level')}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.anti_theft_level.label}</label>
                  <CustomSelect
                    value={antiTheftLevel}
                    onChange={setAntiTheftLevel}
                    options={getVehicleLevelOptions('anti_theft_level')}
                  />
                </div>
              </div>
            </div>

            {/* EK DONANIM & SATIŞ */}
            <div className="pt-2 space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Ek Donanım & Satış</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.turbo.label}</label>
                  <CustomSelect value={turbo ? '1' : '0'} onChange={(value) => setTurbo(value === '1')} options={getVehicleLevelOptions('turbo')} />
                </div>

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
                  type="text"
                  inputMode="numeric"
                  value={formatTurkishInteger(factoryPrice)}
                  onChange={(e) => updateMoney(e.target.value, setFactoryPrice)}
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
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFurnished(checked);
                    if (!checked) setFurnitureValue('');
                  }}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Market Değeri ($)</label>
                <input type="text" inputMode="numeric" value={formatTurkishInteger(marketValue)} onChange={(e) => updateMoney(e.target.value, setMarketValue)} className="form-input text-sm" />
              </div>
              {furnished && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">Eşya Bedeli ($)</label>
                  <input type="text" inputMode="numeric" value={formatTurkishInteger(furnitureValue)} onChange={(e) => updateMoney(e.target.value, setFurnitureValue)} className="form-input text-sm" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* FOTOĞRAFLAR */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--border-app)] pb-2">
            3. Fotoğraflar
          </h3>
          <PhotoUploader images={images} onChange={setImages} maxImages={category === 'property' ? 5 : 3} />
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

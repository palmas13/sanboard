'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Car,
  Home,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  Eye,
  Send,
  AlertCircle,
  Loader2,
  MapPin,
  Calendar,
} from 'lucide-react';
import { PhotoUploader, UploadedImage } from '@/components/forms/PhotoUploader';
import { formatCurrency } from '@/lib/utils/format';
import { getVehicleBrands, getModelsByBrand } from '@/lib/constants/vehicleCatalog';

const TITLE_MAX = 60;
const DESC_MAX = 100;

export default function YeniIlanOlusturPage() {
  const router = useRouter();
  const { currentProfile, isAuthenticated, isLoading } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorSummary, setErrorSummary] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Form Fields - Completely empty initial states!
  const [category, setCategory] = useState<'vehicle' | 'property'>('vehicle');
  const [subcategory, setSubcategory] = useState<string>('Otomobil');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');

  // Vehicle Details (Brand -> Model dependent selection)
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');

  const vehicleBrands = React.useMemo(() => getVehicleBrands(), []);
  const availableModels = React.useMemo(() => getModelsByBrand(brand), [brand]);

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    setModel(''); // Automatically reset model selection when brand changes
  };
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

  // Photos - Truly EMPTY initially, no default/dummy images!
  const [images, setImages] = useState<UploadedImage[]>([]);

  // Auth guard & Credit check
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !currentProfile) {
      router.push('/giris?redirect=/ilan-ver/yeni');
      return;
    }

    // Verify user actually has an available credit
    fetch(`/api/credits?profileId=${currentProfile.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.availableCredits || data.availableCredits <= 0) {
          router.replace('/ilan-ver/paket');
        }
      })
      .catch(() => {
        router.replace('/ilan-ver/paket');
      });
  }, [isAuthenticated, currentProfile, router]);

  const handleNextFromCategory = () => {
    if (category === 'vehicle') {
      setSubcategory('Otomobil');
    } else {
      setSubcategory('Ev / Daire');
    }
    setStep(2);
  };

  const handleNextFromDetails = () => {
    setError('');
    const errors: string[] = [];
    const invalid: Record<string, boolean> = {};

    if (!title.trim() || title.length > TITLE_MAX) {
      errors.push(`İlan başlığı 1-${TITLE_MAX} karakter arasında olmalıdır.`);
      invalid.title = true;
    }
    if (description.length > DESC_MAX) {
      errors.push(`Açıklama maksimum ${DESC_MAX} karakter olabilir.`);
      invalid.description = true;
    }
    if (!price || Number(price) <= 0) {
      errors.push('Lütfen geçerli bir satış fiyatı giriniz.');
      invalid.price = true;
    }

    if (category === 'property') {
      if (!location.trim()) {
        errors.push('Mülk konumu zorunludur.');
        invalid.location = true;
      }
    }

    if (category === 'vehicle') {
      if (!brand.trim()) {
        errors.push('Lütfen araç markasını seçiniz.');
        invalid.brand = true;
      }
      if (!model.trim()) {
        errors.push('Lütfen araç modelini seçiniz.');
        invalid.model = true;
      }
      if (!plate.trim()) {
        errors.push('Plaka bilgisi zorunludur.');
        invalid.plate = true;
      }
      if (mileage === '' || Number(mileage) < 0) {
        errors.push('Kilometre negatif olamaz.');
        invalid.mileage = true;
      }
    }

    if (errors.length > 0) {
      setErrorSummary(errors);
      setInvalidFields(invalid);
      setTimeout(() => {
        errorSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      return;
    }

    setErrorSummary([]);
    setInvalidFields({});
    setStep(3);
  };

  const handleNextFromPhotos = () => {
    setError('');
    const errors: string[] = [];

    if (images.length === 0) {
      errors.push('En az 1 adet fotoğraf yüklemelisiniz.');
    } else if (!images.some((img) => img.is_cover)) {
      errors.push('Lütfen bir fotoğrafı vitrin fotoğrafı olarak seçiniz.');
    }

    if (errors.length > 0) {
      setErrorSummary(errors);
      setTimeout(() => {
        errorSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      return;
    }

    setErrorSummary([]);
    setStep(4);
  };

  const handlePublish = async () => {
    if (!currentProfile) return;
    setSubmitting(true);
    setError('');
    setErrorSummary([]);

    const payload: any = {
      sellerProfileId: currentProfile.id,
      category,
      subcategory,
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      images,
    };

    if (category === 'vehicle') {
      payload.brand = brand.trim();
      payload.model = model.trim();
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
      payload.floor = Number(floor);
      payload.room_count = roomCount;
      payload.furnished = furnished;
      payload.building_type = buildingType;
      payload.balcony = balcony;
    }

    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İlan yayınlanamadı.');

      router.push(`/ilan/${data.listing.id}?success=true`);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
      setSubmitting(false);
    }
  };

  const coverImage = images.find((i) => i.is_cover)?.storage_path || images[0]?.storage_path;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Stepper Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
          Yeni İlan Oluştur
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          7 Günlük Standart İlan hakkını kullanarak ilanını San Andreas'a duyur.
        </p>

        {/* Stepper pills */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 pt-4 text-xs font-bold text-[var(--text-dim)]">
          <span className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30' : 'bg-[var(--bg-surface-secondary)]'}`}>
            1. Kategori
          </span>
          <span className="text-[var(--text-dim)]">›</span>
          <span className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30' : 'bg-[var(--bg-surface-secondary)]'}`}>
            2. Bilgiler
          </span>
          <span className="text-[var(--text-dim)]">›</span>
          <span className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30' : 'bg-[var(--bg-surface-secondary)]'}`}>
            3. Fotoğraflar
          </span>
          <span className="text-[var(--text-dim)]">›</span>
          <span className={`px-3 py-1 rounded-full ${step === 4 ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30' : 'bg-[var(--bg-surface-secondary)]'}`}>
            4. Önizleme
          </span>
        </div>
      </div>

      {/* ERROR SUMMARY BOX (with ref for smooth scroll) */}
      {errorSummary.length > 0 && (
        <div
          ref={errorSummaryRef}
          className="p-5 rounded-2xl bg-[var(--color-danger-subtle)] border-2 border-[var(--color-danger)]/50 text-[var(--color-danger)] space-y-2.5 shadow-lg animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>İlanı tamamlamak için aşağıdaki alanları kontrol edin:</span>
          </div>
          <ul className="list-disc list-inside text-xs space-y-1 pl-1">
            {errorSummary.map((err, idx) => (
              <li key={idx} className="font-semibold">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && errorSummary.length === 0 && (
        <div className="p-3.5 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2 border border-[rgba(229,72,77,0.3)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: CATEGORY SELECTION */}
      {step === 1 && (
        <div className="surface-card p-6 sm:p-8 rounded-2xl space-y-6">
          <h2 className="text-lg font-bold text-[var(--text-main)]">
            Hangi kategoride ilan vermek istiyorsun?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setCategory('vehicle')}
              className={`p-6 rounded-xl border-2 flex flex-col items-center text-center gap-3 transition-all cursor-pointer ${
                category === 'vehicle'
                  ? 'border-[#FF8A1F] bg-[var(--brand-orange-subtle)] ring-2 ring-[#FF8A1F]/20'
                  : 'border-[var(--border-app)] hover:border-[var(--border-app-hover)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface-secondary)] flex items-center justify-center">
                <Car className="w-7 h-7 text-[#FF8A1F]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--text-main)]">Araç İlanı</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Otomobil, SUV / Off-Road / Kamyonet, Motosiklet
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCategory('property')}
              className={`p-6 rounded-xl border-2 flex flex-col items-center text-center gap-3 transition-all cursor-pointer ${
                category === 'property'
                  ? 'border-[#FF8A1F] bg-[var(--brand-orange-subtle)] ring-2 ring-[#FF8A1F]/20'
                  : 'border-[var(--border-app)] hover:border-[var(--border-app-hover)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface-secondary)] flex items-center justify-center">
                <Home className="w-7 h-7 text-[#FF8A1F]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--text-main)]">Mülk İlanı</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Ev / Daire, İşyeri, Diğer Mülk
                </p>
              </div>
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleNextFromCategory}
              className="btn-primary py-2.5 px-6 text-sm"
            >
              <span>Devam Et</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: DETAILS & TECHNICAL DATA */}
      {step === 2 && (
        <div className="surface-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
            <h2 className="text-lg font-bold text-[var(--text-main)]">
              {category === 'vehicle' ? 'Araç Detayları' : 'Mülk Detayları'}
            </h2>
            <span className="badge-tag">{category === 'vehicle' ? 'Araç' : 'Mülk'}</span>
          </div>

          <div className="space-y-4">
            {/* Subcategory */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                {category === 'vehicle' ? 'Araç Alt Kategorisi' : 'Mülk Türü'}
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="form-input text-sm"
              >
                {category === 'vehicle' ? (
                  <>
                    <option value="Otomobil">Otomobil</option>
                    <option value="SUV / Off-Road / Kamyonet">SUV / Off-Road / Kamyonet</option>
                    <option value="Motosiklet">Motosiklet</option>
                  </>
                ) : (
                  <>
                    <option value="Ev / Daire">Ev / Daire</option>
                    <option value="İşyeri">İşyeri</option>
                    <option value="Diğer Mülk">Diğer Mülk</option>
                  </>
                )}
              </select>
            </div>

            {/* Title with live counter (max 60) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  İlan Başlığı
                </label>
                <span className={`text-[11px] font-mono font-semibold ${title.length > TITLE_MAX ? 'text-[var(--color-danger)]' : 'text-[var(--text-dim)]'}`}>
                  {title.length} / {TITLE_MAX}
                </span>
              </div>
              <input
                type="text"
                placeholder="Örn: FULL GELİŞTİRME • DÜŞÜK KM • TEMİZ SCHAFTER V12"
                maxLength={TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`form-input text-sm ${invalidFields.title ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
              />
            </div>

            {/* Description with live counter (max 100) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Açıklama (Kısa Tanıtım)
                </label>
                <span className={`text-[11px] font-mono font-semibold ${description.length > DESC_MAX ? 'text-[var(--color-danger)]' : 'text-[var(--text-dim)]'}`}>
                  {description.length} / {DESC_MAX}
                </span>
              </div>
              <textarea
                placeholder="Örn: Garaj arabasıdır, motor ve yürüyen aksamı kusursuzdur."
                maxLength={DESC_MAX}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`form-input text-sm resize-none ${invalidFields.description ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
              />
            </div>

            {/* Price & Location (Location ONLY for property!) */}
            {category === 'property' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Satış Fiyatı ($)
                  </label>
                  <input
                    type="number"
                    placeholder="75000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={`form-input text-sm ${invalidFields.price ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Konum (Bölge)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Rockford Hills, Vinewood..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={`form-input text-sm ${invalidFields.location ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Satış Fiyatı ($)
                </label>
                <input
                  type="number"
                  placeholder="75000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={`form-input text-sm max-w-sm ${invalidFields.price ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                />
              </div>
            )}

            {/* VEHICLE TECHNICAL FIELDS */}
            {category === 'vehicle' && (
              <div className="pt-4 border-t border-[var(--border-app)] space-y-4">
                <h3 className="text-xs font-bold text-[#FF8A1F] uppercase tracking-wider">
                  Araç Teknik Özellikleri
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Marka Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center justify-between">
                      <span>Marka</span>
                      <span className="text-[10px] text-[#FF8A1F] font-bold">Zorunlu</span>
                    </label>
                    <select
                      value={brand}
                      onChange={(e) => handleBrandChange(e.target.value)}
                      className={`form-input text-sm cursor-pointer ${invalidFields.brand ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                    >
                      <option value="">Marka seçin</option>
                      {vehicleBrands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Selection (Dependent on Marka) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center justify-between">
                      <span>Model</span>
                      <span className="text-[10px] text-[#FF8A1F] font-bold">Zorunlu</span>
                    </label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={!brand}
                      className={`form-input text-sm cursor-pointer transition-opacity ${
                        !brand ? 'opacity-50 cursor-not-allowed bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]' : ''
                      } ${invalidFields.model ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                    >
                      <option value="">
                        {!brand ? 'Önce marka seçin' : 'Model seçin'}
                      </option>
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Plaka</label>
                    <input
                      type="text"
                      placeholder="62LS901"
                      value={plate}
                      onChange={(e) => setPlate(e.target.value)}
                      className={`form-input text-sm uppercase ${invalidFields.plate ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Kilometre</label>
                    <input
                      type="number"
                      placeholder="4200"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      className={`form-input text-sm ${invalidFields.mileage ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                    />
                  </div>
                </div>

                {/* Upgrades (0 to 4) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Motor Geliştirmesi</label>
                    <select
                      value={engineUpgrade}
                      onChange={(e) => setEngineUpgrade(e.target.value)}
                      className="form-input text-sm"
                    >
                      <option value="0">Seviye 0</option>
                      <option value="1">Seviye 1</option>
                      <option value="2">Seviye 2</option>
                      <option value="3">Seviye 3</option>
                      <option value="4">Seviye 4</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Şanzıman Geliştirmesi</label>
                    <select
                      value={transmissionUpgrade}
                      onChange={(e) => setTransmissionUpgrade(e.target.value)}
                      className="form-input text-sm"
                    >
                      <option value="0">Seviye 0</option>
                      <option value="1">Seviye 1</option>
                      <option value="2">Seviye 2</option>
                      <option value="3">Seviye 3</option>
                      <option value="4">Seviye 4</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Fren Geliştirmesi</label>
                    <select
                      value={brakeUpgrade}
                      onChange={(e) => setBrakeUpgrade(e.target.value)}
                      className="form-input text-sm"
                    >
                      <option value="0">Seviye 0</option>
                      <option value="1">Seviye 1</option>
                      <option value="2">Seviye 2</option>
                      <option value="3">Seviye 3</option>
                      <option value="4">Seviye 4</option>
                    </select>
                  </div>
                </div>

                {/* Booleans: Turbo, Subwoofer, Trade */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <label className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={turbo}
                      onChange={(e) => setTurbo(e.target.checked)}
                      className="w-4 h-4 accent-[#FF8A1F]"
                    />
                    <span className="text-xs font-semibold text-[var(--text-main)]">Turbo: Var</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subwoofer}
                      onChange={(e) => setSubwoofer(e.target.checked)}
                      className="w-4 h-4 accent-[#FF8A1F]"
                    />
                    <span className="text-xs font-semibold text-[var(--text-main)]">Subwoofer: Var</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tradeAvailable}
                      onChange={(e) => setTradeAvailable(e.target.checked)}
                      className="w-4 h-4 accent-[#FF8A1F]"
                    />
                    <span className="text-xs font-semibold text-[var(--text-main)]">Takasa Açık</span>
                  </label>
                </div>
              </div>
            )}

            {/* PROPERTY TECHNICAL FIELDS */}
            {category === 'property' && (
              <div className="pt-4 border-t border-[var(--border-app)] space-y-4">
                <h3 className="text-xs font-bold text-[#FF8A1F] uppercase tracking-wider">
                  Mülk Özellikleri
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Oda Sayısı</label>
                    <select
                      value={roomCount}
                      onChange={(e) => setRoomCount(e.target.value)}
                      className="form-input text-sm"
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
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Kaçıncı Kat</label>
                    <input
                      type="number"
                      placeholder="1"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className="form-input text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Yapı Tipi</label>
                    <select
                      value={buildingType}
                      onChange={(e) => setBuildingType(e.target.value)}
                      className="form-input text-sm"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Dubleks">Dubleks</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <label className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={furnished}
                      onChange={(e) => setFurnished(e.target.checked)}
                      className="w-4 h-4 accent-[#FF8A1F]"
                    />
                    <span className="text-xs font-semibold text-[var(--text-main)]">Eşyalı: Evet</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={balcony}
                      onChange={(e) => setBalcony(e.target.checked)}
                      className="w-4 h-4 accent-[#FF8A1F]"
                    />
                    <span className="text-xs font-semibold text-[var(--text-main)]">Balkon / Teras: Var</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-[var(--border-app)]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary py-2.5 px-5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Geri</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromDetails}
              className="btn-primary py-2.5 px-6 text-sm"
            >
              <span>Fotoğraflara Geç</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PHOTO MANAGEMENT */}
      {step === 3 && (
        <div className="surface-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-main)]">
                İlan Fotoğrafları
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                En az 1, en fazla 3 fotoğraf ekleyin. Bir fotoğrafı vitrin (kapak) görseli olarak seçin.
              </p>
            </div>
            <span className="badge-tag">{images.length} / 3 Fotoğraf</span>
          </div>

          <PhotoUploader images={images} onChange={setImages} />

          <div className="flex justify-between pt-4 border-t border-[var(--border-app)]">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn-secondary py-2.5 px-5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Bilgilere Dön</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromPhotos}
              className="btn-primary py-2.5 px-6 text-sm"
            >
              <span>Önizlemeye Geç</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PREVIEW & PUBLISH */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="surface-card p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#FF8A1F]" />
              <span>İlan Önizlemesi</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              İlanınız yayınlandıktan sonra arama sonuçlarında ve detay sayfasında bu şekilde görünecektir.
            </p>

            {/* Mini Card Preview */}
            <div className="max-w-sm mx-auto surface-card p-4 rounded-xl border border-[#FF8A1F]/30 bg-[var(--bg-surface-secondary)]/30 space-y-3">
              <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-black/30">
                <img
                  src={coverImage}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 badge-tag bg-black/60 text-white border-white/20 text-[10px]">
                  {subcategory}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xl font-extrabold text-[#FF8A1F]">
                  {formatCurrency(Number(price) || 0)}
                </div>
                <h4 className="text-sm font-bold text-[var(--text-main)] line-clamp-1">{title}</h4>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2">{description}</p>
                <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-dim)] border-t border-[var(--border-app)]">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#FF8A1F]" />
                    {location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    7 Gün Aktif
                  </span>
                </div>
              </div>
            </div>

            {/* Selected Vehicle Specs Summary */}
            {category === 'vehicle' && (
              <div className="max-w-sm mx-auto p-3.5 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-xs space-y-2">
                <p className="font-bold text-[var(--text-main)] text-[11px] uppercase tracking-wider text-[#FF8A1F]">
                  Seçilen Araç Bilgileri
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[var(--text-muted)]">Marka: </span>
                    <span className="font-bold text-[var(--text-main)]">{brand}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Model: </span>
                    <span className="font-bold text-[var(--text-main)]">{model}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Plaka: </span>
                    <span className="font-bold text-[var(--text-main)] font-mono">{plate}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Kilometre: </span>
                    <span className="font-bold text-[var(--text-main)]">
                      {Number(mileage).toLocaleString('tr-TR')} km
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-[var(--brand-orange-subtle)] border border-[rgba(255,138,31,0.25)] text-center text-xs text-[var(--text-main)]">
            <p className="font-semibold text-[#FF8A1F]">
              İlanı yayınladığınız anda 1 adet ilan krediniz kullanılacak ve 7 günlük yayın süreniz başlayacaktır.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="btn-secondary py-2.5 px-5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Fotoğraflara Dön</span>
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={submitting}
              className="btn-primary py-3 px-8 text-sm font-bold flex items-center gap-2 shadow-xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Yayınlanıyor...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>İlanı Şimdi Yayınla</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

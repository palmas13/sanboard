'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Car,
  Home,
  ArrowRight,
  ArrowLeft,
  Eye,
  Send,
  AlertCircle,
  Loader2,
  MapPin,
  Calendar,
  Crown,
  Save,
  Trash2,
} from 'lucide-react';
import { PhotoUploader, UploadedImage } from '@/components/forms/PhotoUploader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { formatCurrency } from '@/lib/utils/format';
import { getVehicleBrandsByCategory, getVehicleModels, isMotorcycleCategory, isValidVehicleSelection, reconcileVehicleSelection, VEHICLE_CATEGORIES, VehicleCategory } from '@/lib/constants/vehicleCategories';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';
import { calculateListingQuality } from '@/lib/listings/quality';
import { ListingQualityIndicator } from '@/components/listings/ListingQualityIndicator';
import { LISTING_TITLE_MAX_ERROR, LISTING_TITLE_MAX_LENGTH } from '@/lib/validations/listing';
import { getVehicleLevelOptions, normalizeVehicleLevel, VEHICLE_LEVEL_FIELDS } from '@/lib/listings/vehicle-levels';
import { formatTurkishInteger, isIntegerInRange, normalizeIntegerInput, normalizeTurkishIntegerInput } from '@/lib/forms/integer-input';
import { readJsonResponse } from '@/lib/http/json-response';
import { toListingImageReferences } from '@/lib/listings/image-references';

const TITLE_MAX = LISTING_TITLE_MAX_LENGTH;
const DESC_MAX = 100;
const DRAFT_VERSION = 2;

export default function YeniIlanOlusturPage() {
  const router = useRouter();
  const { currentProfile, isAuthenticated, isLoading } = useAuth();

  const [isCorporate, setIsCorporate] = useState(false);
  const [dealer, setDealer] = useState<any>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [testPublishBypass, setTestPublishBypass] = useState(false);
  const [errorSummary, setErrorSummary] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Form Fields - Completely empty initial states!
  const [category, setCategory] = useState<'vehicle' | 'property'>('vehicle');
  const [subcategory, setSubcategory] = useState<string>('Otomobil');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [offersEnabled, setOffersEnabled] = useState(true);
  const [minimumOffer, setMinimumOffer] = useState('');
  const [location, setLocation] = useState('');

  // Vehicle Details (Brand -> Model dependent selection)
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');

  const vehicleCategory = subcategory as VehicleCategory;
  const vehicleBrands = React.useMemo(() => getVehicleBrandsByCategory(vehicleCategory), [vehicleCategory]);
  const availableModels = React.useMemo(() => getVehicleModels(vehicleCategory, brand), [vehicleCategory, brand]);

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    setModel(''); // Automatically reset model selection when brand changes
  };
  const handleVehicleCategoryChange = (newCategory: string) => {
    const nextCategory = newCategory as VehicleCategory;
    const next = reconcileVehicleSelection(nextCategory, brand, model);
    setSubcategory(nextCategory);
    setBrand(next.brand);
    setModel(next.model);
    if (isMotorcycleCategory(nextCategory)) setSuspension('');
  };
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

  // Photos - Truly EMPTY initially, no default/dummy images!
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const draftStorageKey = currentProfile
    ? `sanboard_listing_draft_v${DRAFT_VERSION}_${currentProfile.id}_${isCorporate ? 'corporate' : 'individual'}`
    : null;

  const updateInteger = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const normalized = normalizeIntegerInput(value);
    if (normalized !== null) setter(normalized);
  };

  const updateMoney = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const normalized = normalizeTurkishIntegerInput(value);
    if (normalized !== null) setter(normalized);
  };

  useEffect(() => {
    if (!draftStorageKey) return;
    setDraftReady(false);
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const draft = JSON.parse(raw);
        setStep(draft.step || 1);
        setCategory(draft.category || 'vehicle');
        const restoredSubcategory = draft.subcategory || 'Otomobil';
        setSubcategory(restoredSubcategory);
        setTitle(draft.title || '');
        setDescription(draft.description || '');
        setPrice(normalizeTurkishIntegerInput(String(draft.price || '')) || '');
        setOffersEnabled(draft.offersEnabled !== false);
        setMinimumOffer(normalizeTurkishIntegerInput(String(draft.minimumOffer || '')) || '');
        setLocation(draft.location || '');
        const restoredVehicle = reconcileVehicleSelection(restoredSubcategory as VehicleCategory, draft.brand || '', draft.model || '');
        setBrand(restoredVehicle.brand);
        setModel(restoredVehicle.model);
        setPlate(draft.plate || '');
        setMileage(normalizeIntegerInput(String(draft.mileage || '')) || '');
        setEngineUpgrade(normalizeVehicleLevel(draft.engineUpgrade, 'engine_upgrade'));
        setTransmissionUpgrade(normalizeVehicleLevel(draft.transmissionUpgrade, 'transmission_upgrade'));
        setBrakeUpgrade(normalizeVehicleLevel(draft.brakeUpgrade, 'brake_upgrade'));
        setTurbo(normalizeVehicleLevel(draft.turbo ? 1 : 0, 'turbo') === '1');
        setSubwoofer(Boolean(draft.subwoofer));
        setTradeAvailable(Boolean(draft.tradeAvailable));
        setLockLevel(normalizeVehicleLevel(draft.lockLevel, 'lock_level'));
        setAlarmLevel(normalizeVehicleLevel(draft.alarmLevel, 'alarm_level'));
        setAntiTheftLevel(normalizeVehicleLevel(draft.antiTheftLevel, 'anti_theft_level'));
        setEngineHealth(normalizeIntegerInput(String(draft.engineHealth || '')) || '');
        setSuspension(isMotorcycleCategory(restoredSubcategory as VehicleCategory) ? '' : normalizeVehicleLevel(draft.suspension, 'suspension'));
        setFuelType(draft.fuelType || 'BENZIN');
        setFactoryPrice(normalizeTurkishIntegerInput(String(draft.factoryPrice || '')) || '');
        setFloor(draft.floor || '1');
        setRoomCount(draft.roomCount || '2+1');
        setFurnished(Boolean(draft.furnished));
        setMarketValue(normalizeTurkishIntegerInput(String(draft.marketValue || '')) || '');
        setFurnitureValue(normalizeTurkishIntegerInput(String(draft.furnitureValue || '')) || '');
        setBuildingType(draft.buildingType || 'Normal');
        setBalcony(Boolean(draft.balcony));
        setImages(Array.isArray(draft.images) ? draft.images : []);
        setDraftSavedAt(draft.savedAt || null);
      }
    } catch {
      localStorage.removeItem(draftStorageKey);
    } finally {
      setDraftReady(true);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey || !draftReady) return;
    const draft = {
      step, category, subcategory, title, description, price, offersEnabled, minimumOffer, location, brand, model, plate,
      mileage, engineUpgrade, transmissionUpgrade, brakeUpgrade, turbo, subwoofer,
      tradeAvailable, lockLevel, alarmLevel, antiTheftLevel, engineHealth, suspension,
      fuelType, factoryPrice, floor, roomCount, furnished, marketValue, furnitureValue, buildingType, balcony,
      images: images.map(({ preview_url: _previewUrl, ...image }) => image),
      savedAt: new Date().toISOString(),
    };
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      } catch {
        localStorage.setItem(draftStorageKey, JSON.stringify({ ...draft, images: [] }));
      }
      setDraftSavedAt(draft.savedAt);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftStorageKey, draftReady, step, category, subcategory, title, description, price, offersEnabled, minimumOffer, location, brand, model, plate, mileage, engineUpgrade, transmissionUpgrade, brakeUpgrade, turbo, subwoofer, tradeAvailable, lockLevel, alarmLevel, antiTheftLevel, engineHealth, suspension, fuelType, factoryPrice, floor, roomCount, furnished, marketValue, furnitureValue, buildingType, balcony, images]);

  const clearDraft = () => {
    if (!window.confirm('Bu taslağı silmek istediğinize emin misiniz?')) return;
    if (draftStorageKey) localStorage.removeItem(draftStorageKey);
    setDraftSavedAt(null);
    setStep(1);
    setCategory('vehicle');
    setSubcategory('Otomobil');
    setTitle('');
    setDescription('');
    setPrice('');
    setOffersEnabled(true);
    setMinimumOffer('');
    setLocation('');
    setBrand('');
    setModel('');
    setPlate('');
    setMileage('');
    setEngineUpgrade('0');
    setTransmissionUpgrade('0');
    setBrakeUpgrade('0');
    setTurbo(false);
    setSubwoofer(false);
    setTradeAvailable(false);
    setLockLevel('');
    setAlarmLevel('');
    setAntiTheftLevel('');
    setEngineHealth('');
    setSuspension('');
    setFuelType('BENZIN');
    setFactoryPrice('');
    setFloor('1');
    setRoomCount('2+1');
    setFurnished(false);
    setMarketValue('');
    setFurnitureValue('');
    setBuildingType('Normal');
    setBalcony(false);
    setImages([]);
  };

  // Auth guard & Credit check
  useEffect(() => {
    let corpParam = false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('corporate') === 'true') {
        setIsCorporate(true);
        corpParam = true;
      }
    }

    if (isLoading) return;
    if (!isAuthenticated || !currentProfile) {
      router.push(`/giris?redirect=/ilan-ver/yeni${corpParam ? '?corporate=true' : ''}`);
      return;
    }

    if (corpParam) {
      // Authoritative corporate eligibility and store-scoped credit check.
      fetch('/api/dealers/eligibility')
        .then((res) => res.json())
        .then(async (eligData) => {
          if (!eligData.eligible || !eligData.dealer) {
            router.replace('/hesabim/kurumsal');
            return;
          }
          setDealer(eligData.dealer);
          const creditResponse = await fetch(`/api/credits?corporateProfileId=${encodeURIComponent(eligData.dealer.id)}`);
          const creditData = await creditResponse.json();
          const canBypassPayment = creditData.testPublishBypass === true;
          setTestPublishBypass(canBypassPayment);
          if ((creditData.scopedCorporateCredits || 0) < 1 && !canBypassPayment) {
            router.replace('/hesabim/kurumsal');
          }
        })
        .catch(() => {
          router.replace('/hesabim/kurumsal');
        });
    }

    // Verify user actually has an available credit for the chosen mode (INDIVIDUAL vs CORPORATE)
    if (corpParam) return;
    fetch('/api/credits')
      .then((res) => res.json())
      .then((data) => {
        const canBypassPayment = data.testPublishBypass === true;
        setTestPublishBypass(canBypassPayment);
        const hasNeededCredit = data.individualCredits !== undefined ? data.individualCredits > 0 : data.availableCredits > 0;

        if (!hasNeededCredit && !canBypassPayment) {
          router.replace('/ilan-ver/paket');
        }
      })
      .catch(() => {
        router.replace('/ilan-ver/paket');
      });
  }, [isLoading, isAuthenticated, currentProfile, router]);

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
      errors.push(title.trim() ? LISTING_TITLE_MAX_ERROR : 'İlan başlığı zorunludur.');
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
    if (minimumOffer !== '' && (Number(minimumOffer) <= 0 || Number(minimumOffer) > Number(price))) {
      errors.push('Minimum teklif 0’dan büyük ve satış fiyatından yüksek olmamalıdır.');
      invalid.minimumOffer = true;
    }

    if (category === 'property') {
      if (!location.trim()) {
        errors.push('Mülk konumu zorunludur.');
        invalid.location = true;
      }
      if (!isIntegerInRange(marketValue, 1, 1_000_000_000)) {
        errors.push('Market değeri 0’dan büyük bir tam sayı olmalıdır.');
        invalid.marketValue = true;
      }
      if (furnished && !isIntegerInRange(furnitureValue, 1, 1_000_000_000)) {
        errors.push('Eşyalı mülklerde eşya bedeli 0’dan büyük bir tam sayı olmalıdır.');
        invalid.furnitureValue = true;
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
      if (!isValidVehicleSelection(vehicleCategory, brand, model)) {
        errors.push('Lütfen kategoriyle uyumlu geçerli bir marka ve model seçiniz.');
        invalid.brand = true;
        invalid.model = true;
      }
      if (!plate.trim()) {
        errors.push('Plaka bilgisi zorunludur.');
        invalid.plate = true;
      }
      if (mileage === '' || !isIntegerInRange(mileage, 0, Number.MAX_SAFE_INTEGER)) {
        errors.push('Kilometre 0 veya daha büyük bir tam sayı olmalıdır.');
        invalid.mileage = true;
      }
      if (engineHealth !== '' && !isIntegerInRange(engineHealth, 0, 100)) {
        errors.push('Motor sağlığı %0 ile %100 arasında bir tam sayı olmalıdır.');
        invalid.engineHealth = true;
      }
      if (lockLevel !== '' && Number(lockLevel) < 0) {
        errors.push('Kilit seviyesi 0 veya daha büyük olmalıdır.');
        invalid.lockLevel = true;
      }
      if (alarmLevel !== '' && Number(alarmLevel) < 0) {
        errors.push('Alarm seviyesi 0 veya daha büyük olmalıdır.');
        invalid.alarmLevel = true;
      }
      if (antiTheftLevel !== '' && Number(antiTheftLevel) < 0) {
        errors.push('Hırsızlık önleme seviyesi 0 veya daha büyük olmalıdır.');
        invalid.antiTheftLevel = true;
      }
      if (factoryPrice !== '' && !isIntegerInRange(factoryPrice, 1, 1_000_000_000)) {
        errors.push('Fabrika çıkış fiyatı 0’dan büyük bir tam sayı olmalıdır.');
        invalid.factoryPrice = true;
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
    } else if (images.length > (category === 'property' ? 5 : 3)) {
      errors.push(`${category === 'property' ? 'Mülk' : 'Araç'} ilanlarında en fazla ${category === 'property' ? 5 : 3} fotoğraf yükleyebilirsiniz.`);
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
    if (!currentProfile || submitting) return;
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
      offers_enabled: offersEnabled,
      minimum_offer_amount: offersEnabled && minimumOffer !== '' ? Number(minimumOffer) : null,
      images: toListingImageReferences(images),
      corporate: isCorporate,
      seller_type: isCorporate ? 'CORPORATE' : 'INDIVIDUAL',
      corporate_profile_id: isCorporate && dealer?.id ? dealer.id : null,
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
      payload.lock_level = Number(lockLevel);
      payload.alarm_level = Number(alarmLevel);
      payload.anti_theft_level = Number(antiTheftLevel);
      payload.engine_health = engineHealth !== '' ? Number(engineHealth) : null;
      payload.suspension = isMotorcycleCategory(vehicleCategory) ? null : (suspension !== '' ? Number(suspension) : null);
      payload.fuel_type = fuelType || null;
      payload.factory_price = factoryPrice !== '' ? Number(factoryPrice) : null;
    } else {
      payload.location = location.trim();
      payload.floor = Number(floor);
      payload.room_count = roomCount;
      payload.furnished = furnished;
      payload.market_value = Number(marketValue);
      payload.furniture_value = furnished ? Number(furnitureValue) : null;
      payload.building_type = buildingType;
      payload.balcony = balcony;
    }

    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse<{ listing: any }>(res, 'İlan yayınlanamadı.');

      if (draftStorageKey) localStorage.removeItem(draftStorageKey);
      router.push(`${getListingUrl(data.listing)}?success=true`);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
      setSubmitting(false);
    }
  };

  const coverImage = images.find((i) => i.is_cover)?.storage_path || images[0]?.storage_path;
  const listingQuality = calculateListingQuality({
    category, subcategory, title, description, price, location, imageCount: images.length,
    hasContact: Boolean(currentProfile?.phone?.trim() || currentProfile?.sanmail_email?.trim()),
    brand, model, mileage, fuelType, engineHealth, plate,
    propertyType: category === 'property' ? subcategory : undefined,
    roomCount, floor, buildingType,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Stepper Header */}
      <div className="text-center space-y-2">
        {isCorporate && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FF8A1F]/10 border border-[#FF8A1F]/30 text-[#FF8A1F] text-xs font-bold mb-1">
            <Crown className="w-3.5 h-3.5 fill-[#FF8A1F]" />
            <span>Kurumsal Mağaza İlanı Modu{dealer?.company_name ? ` (${dealer.company_name})` : ''}</span>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)]">
          {isCorporate ? 'Yeni Mağaza İlanı Oluştur' : 'Yeni İlan Oluştur'}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          {isCorporate
            ? `${dealer?.company_name ? `${dealer.company_name} kurumsal` : 'Kurumsal'} vitrininize özel 14 günlük ilanınızı oluşturun.`
            : '7 Günlük Standart İlan hakkını kullanarak ilanını Los Santos\'a duyur.'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5 text-[#FF8A1F]" />
            {draftSavedAt ? `Taslak otomatik kaydedildi (${new Date(draftSavedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})` : 'Taslak otomatik kaydedilir'}
          </span>
          {draftSavedAt && (
            <button type="button" onClick={clearDraft} className="inline-flex items-center gap-1 font-semibold text-[var(--color-danger)] hover:underline">
              <Trash2 className="h-3.5 w-3.5" />
              Taslağı temizle
            </button>
          )}
        </div>

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

      <ListingQualityIndicator quality={listingQuality} compact />

      {testPublishBypass && (
        <div className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)]">
          Test hesabı: ödeme doğrulaması atlandı.
        </div>
      )}

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
                  Otomobil, Motosiklet, SUV, Pickup, ATV ve Ticari
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
                onChange={(e) => category === 'vehicle' ? handleVehicleCategoryChange(e.target.value) : setSubcategory(e.target.value)}
                className="form-input text-sm"
              >
                {category === 'vehicle' ? (
                  <>
                    {VEHICLE_CATEGORIES.map((vehicleCategoryOption) => <option key={vehicleCategoryOption} value={vehicleCategoryOption}>{vehicleCategoryOption}</option>)}
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

            {/* Title with live counter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  İlan Başlığı
                </label>
                <span className={`text-[11px] font-mono font-semibold ${title.length >= TITLE_MAX - 5 ? 'text-amber-400' : 'text-[var(--text-dim)]'}`}>
                  {title.length} / {TITLE_MAX}
                </span>
              </div>
              <input
                type="text"
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
                    type="text"
                    inputMode="numeric"
                    value={formatTurkishInteger(price)}
                    onChange={(e) => updateMoney(e.target.value, setPrice)}
                    className={`form-input text-sm ${invalidFields.price ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Konum (Bölge)
                  </label>
                  <input
                    type="text"
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
                  type="text"
                  inputMode="numeric"
                  value={formatTurkishInteger(price)}
                  onChange={(e) => updateMoney(e.target.value, setPrice)}
                  className={`form-input text-sm max-w-sm ${invalidFields.price ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                />
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-[var(--border-app)] p-4">
              <label className="flex items-center justify-between gap-4 text-xs font-semibold text-[var(--text-muted)]">
                <span><b className="block text-[var(--text-main)]">Tekliflere Açık</b>Alıcılar yalnız fiyat teklifi verebilir; serbest mesaj gönderemez.</span>
                <input type="checkbox" checked={offersEnabled} onChange={(e) => setOffersEnabled(e.target.checked)} className="h-5 w-5 accent-[#FF8A1F]" />
              </label>
              {offersEnabled && <label className="block text-xs font-semibold text-[var(--text-muted)]">Minimum Teklif (opsiyonel)
                <input type="text" inputMode="numeric" value={formatTurkishInteger(minimumOffer)} onChange={(e) => updateMoney(e.target.value, setMinimumOffer)} className={`form-input mt-2 ${invalidFields.minimumOffer ? 'border-red-500' : ''}`} />
              </label>}
            </div>

            {/* VEHICLE TECHNICAL FIELDS */}
            {category === 'vehicle' && (
              <div className="pt-4 border-t border-[var(--border-app)] space-y-5">
                {/* 1. TEMEL BİLGİLER */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[#FF8A1F] uppercase tracking-wider">
                    Temel Araç Bilgileri
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Marka Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center justify-between">
                        <span>Marka</span>
                        <span className="text-[10px] text-[#FF8A1F] font-bold">Zorunlu</span>
                      </label>
                      <CustomSelect
                        value={brand}
                        onChange={handleBrandChange}
                        placeholder="Marka seçin"
                        options={vehicleBrands.map((b) => ({ value: b, label: b }))}
                      />
                    </div>

                    {/* Model Selection (Dependent on Marka) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center justify-between">
                        <span>Model</span>
                        <span className="text-[10px] text-[#FF8A1F] font-bold">Zorunlu</span>
                      </label>
                      <CustomSelect
                        value={model}
                        onChange={(v) => setModel(v)}
                        disabled={!brand}
                        placeholder={!brand ? 'Önce marka seçin' : 'Model seçin'}
                        options={availableModels.map((m) => ({ value: m, label: m }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Plaka</label>
                      <input
                        type="text"
                        value={plate}
                        onChange={(e) => setPlate(e.target.value.toUpperCase())}
                        className={`form-input text-sm uppercase font-mono font-bold ${invalidFields.plate ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Kilometre</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mileage}
                        onChange={(e) => updateInteger(e.target.value, setMileage)}
                        className={`form-input text-sm ${invalidFields.mileage ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. MEKANİK & PERFORMANS */}
                <div className="pt-3 border-t border-[var(--border-app)] space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    Mekanik & Performans
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.engine_upgrade.label}</label>
                      <CustomSelect
                        value={engineUpgrade}
                        onChange={(v) => setEngineUpgrade(v)}
                        options={getVehicleLevelOptions('engine_upgrade')}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.transmission_upgrade.label}</label>
                      <CustomSelect
                        value={transmissionUpgrade}
                        onChange={(v) => setTransmissionUpgrade(v)}
                        options={getVehicleLevelOptions('transmission_upgrade')}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.brake_upgrade.label}</label>
                      <CustomSelect
                        value={brakeUpgrade}
                        onChange={(v) => setBrakeUpgrade(v)}
                        options={getVehicleLevelOptions('brake_upgrade')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[var(--text-dim)] font-medium">Motor Sağlığı (%0 - 100)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={engineHealth}
                        onChange={(e) => updateInteger(e.target.value, setEngineHealth)}
                        className={`form-input text-sm ${invalidFields.engineHealth ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
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

                {/* 3. GÜVENLİK */}
                <div className="pt-3 border-t border-[var(--border-app)] space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    Güvenlik Seviyeleri
                  </h3>

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

                {/* 4. EK DONANIM & SATIŞ */}
                <div className="pt-3 border-t border-[var(--border-app)] space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                    Ek Donanım & Satış
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[var(--text-dim)] font-medium">{VEHICLE_LEVEL_FIELDS.turbo.label}</label>
                      <CustomSelect value={turbo ? '1' : '0'} onChange={(value) => setTurbo(value === '1')} options={getVehicleLevelOptions('turbo')} />
                    </div>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subwoofer}
                        onChange={(e) => setSubwoofer(e.target.checked)}
                        className="rounded border-[var(--border-app)] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                      />
                      <span className="text-xs font-semibold text-[var(--text-main)]">Subwoofer Ses</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tradeAvailable}
                        onChange={(e) => setTradeAvailable(e.target.checked)}
                        className="rounded border-[var(--border-app)] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                      />
                      <span className="text-xs font-semibold text-[var(--text-main)]">Takasa Açık</span>
                    </label>
                  </div>

                  <div className="space-y-1.5 pt-1 max-w-sm">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Fabrika Çıkış Fiyatı ($)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatTurkishInteger(factoryPrice)}
                      onChange={(e) => updateMoney(e.target.value, setFactoryPrice)}
                      className={`form-input text-sm ${invalidFields.factoryPrice ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                    />
                  </div>
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
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFurnished(checked);
                        if (!checked) setFurnitureValue('');
                      }}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">Market Değeri ($)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatTurkishInteger(marketValue)}
                      onChange={(e) => updateMoney(e.target.value, setMarketValue)}
                      className={`form-input text-sm ${invalidFields.marketValue ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                    />
                  </div>
                  {furnished && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-muted)]">Eşya Bedeli ($)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatTurkishInteger(furnitureValue)}
                        onChange={(e) => updateMoney(e.target.value, setFurnitureValue)}
                        className={`form-input text-sm ${invalidFields.furnitureValue ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/30' : ''}`}
                      />
                    </div>
                  )}
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
                En az 1, en fazla {category === 'property' ? 5 : 3} fotoğraf ekleyin. Bir fotoğrafı vitrin (kapak) görseli olarak seçin.
              </p>
            </div>
            <span className="badge-tag">{images.length} / {category === 'property' ? 5 : 3} Fotoğraf</span>
          </div>

          <PhotoUploader images={images} onChange={setImages} maxImages={category === 'property' ? 5 : 3} />

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
                  src={resolveMediaUrl(coverImage)}
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
                    {isCorporate ? (
                      <>
                        <Crown className="w-3.5 h-3.5 text-[#FF8A1F]" />
                        <span className="font-semibold text-[var(--text-main)] truncate max-w-[120px]">
                          {dealer?.company_name || 'Kurumsal Mağaza'}
                        </span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3.5 h-3.5 text-[#FF8A1F]" />
                        {location || 'Los Santos'}
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-[#FF8A1F]">
                    <Calendar className="w-3.5 h-3.5" />
                    {isCorporate ? '14 Gün Aktif' : '7 Gün Aktif'}
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
                  <div><span className="text-[var(--text-muted)]">{VEHICLE_LEVEL_FIELDS.brake_upgrade.label}: </span><span className="font-bold text-[var(--text-main)]">{brakeUpgrade}</span></div>
                  <div><span className="text-[var(--text-muted)]">{VEHICLE_LEVEL_FIELDS.engine_upgrade.label}: </span><span className="font-bold text-[var(--text-main)]">{engineUpgrade}</span></div>
                  <div><span className="text-[var(--text-muted)]">{VEHICLE_LEVEL_FIELDS.transmission_upgrade.label}: </span><span className="font-bold text-[var(--text-main)]">{transmissionUpgrade}</span></div>
                  {!isMotorcycleCategory(vehicleCategory) && <div><span className="text-[var(--text-muted)]">{VEHICLE_LEVEL_FIELDS.suspension.label}: </span><span className="font-bold text-[var(--text-main)]">{suspension}</span></div>}
                  <div><span className="text-[var(--text-muted)]">{VEHICLE_LEVEL_FIELDS.turbo.label}: </span><span className="font-bold text-[var(--text-main)]">{turbo ? '1' : '0'}</span></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-[var(--brand-orange-subtle)] border border-[rgba(255,138,31,0.25)] text-center text-xs text-[var(--text-main)] space-y-1">
            <p className="font-semibold text-[#FF8A1F]">
              {isCorporate
                ? 'İlanı yayınladığınız anda 1 adet kurumsal ilan krediniz kullanılacak ve 14 günlük yayın süreniz başlayacaktır.'
                : 'İlanı yayınladığınız anda 1 adet ilan krediniz kullanılacak ve 7 günlük yayın süreniz başlayacaktır.'}
            </p>
            {isCorporate && (
              <p className="text-[11px] text-[var(--text-muted)]">
                Model: Kurumsal İlan ($1.750 / 14 Gün Yayın) • Mağaza: {dealer?.company_name || 'Kurumsal Profil'}
              </p>
            )}
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

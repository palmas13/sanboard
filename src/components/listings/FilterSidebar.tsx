'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { ListingCategory } from '@/types';
import { getVehicleBrandsByCategory, getVehicleModels, VEHICLE_CATEGORIES, VehicleCategory } from '@/lib/constants/vehicleCategories';

interface FilterSidebarProps {
  category: ListingCategory;
  className?: string;
  onFilterChange?: () => void;
}

const LOS_SANTOS_LOCATIONS = [
  'Vinewood',
  'Rockford Hills',
  'Vespucci',
  'Mirror Park',
  'Downtown Los Santos',
  'Del Perro',
  'Sandy Shores',
  'Paleto Bay',
];

export function FilterSidebar({
  category,
  className = '',
  onFilterChange,
}: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local filter states initialized from URL
  const [subcategory, setSubcategory] = useState(searchParams.get('subcategory') || 'all');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [location, setLocation] = useState(searchParams.get('location') || 'all');
  const [sellerType, setSellerType] = useState(
    searchParams.get('sellerType') || searchParams.get('satici') || 'all'
  );

  // Vehicle specific (Brand -> Model hierarchy)
  const [brand, setBrand] = useState(searchParams.get('brand') || 'all');
  const [model, setModel] = useState(searchParams.get('model') || 'all');
  const [minMileage, setMinMileage] = useState(searchParams.get('minMileage') || '');
  const [maxMileage, setMaxMileage] = useState(searchParams.get('maxMileage') || '');
  const [turbo, setTurbo] = useState(searchParams.get('turbo') || 'all');
  const [subwoofer, setSubwoofer] = useState(searchParams.get('subwoofer') || 'all');
  const [trade, setTrade] = useState(searchParams.get('trade') || 'all');

  const selectedVehicleCategory = subcategory !== 'all' ? subcategory as VehicleCategory : null;
  const vehicleBrands = React.useMemo(() => selectedVehicleCategory ? getVehicleBrandsByCategory(selectedVehicleCategory) : [], [selectedVehicleCategory]);
  const availableModels = React.useMemo(
    () => (selectedVehicleCategory && brand && brand !== 'all' ? getVehicleModels(selectedVehicleCategory, brand) : []),
    [selectedVehicleCategory, brand]
  );

  const handleBrandFilterChange = (newBrand: string) => {
    setBrand(newBrand);
    setModel('all'); // Clear model filter when brand changes
  };
  const handleSubcategoryFilterChange = (newCategory: string) => {
    setSubcategory(newCategory);
    setBrand('all');
    setModel('all');
  };

  // Property specific
  const [roomCount, setRoomCount] = useState(searchParams.get('roomCount') || 'all');
  const [furnished, setFurnished] = useState(searchParams.get('furnished') || 'all');
  const [balcony, setBalcony] = useState(searchParams.get('balcony') || 'all');
  const [buildingType, setBuildingType] = useState(searchParams.get('buildingType') || 'all');

  // Keep local state in sync when URL changes externally
  useEffect(() => {
    setSubcategory(searchParams.get('subcategory') || 'all');
    setQuery(searchParams.get('q') || '');
    setMinPrice(searchParams.get('minPrice') || '');
    setMaxPrice(searchParams.get('maxPrice') || '');
    setLocation(searchParams.get('location') || 'all');
    setBrand(searchParams.get('brand') || 'all');
    setModel(searchParams.get('model') || 'all');
    setMinMileage(searchParams.get('minMileage') || '');
    setMaxMileage(searchParams.get('maxMileage') || '');
    setTurbo(searchParams.get('turbo') || 'all');
    setSubwoofer(searchParams.get('subwoofer') || 'all');
    setTrade(searchParams.get('trade') || 'all');
    setRoomCount(searchParams.get('roomCount') || 'all');
    setFurnished(searchParams.get('furnished') || 'all');
    setBalcony(searchParams.get('balcony') || 'all');
    setBuildingType(searchParams.get('buildingType') || 'all');
    setSellerType(searchParams.get('sellerType') || searchParams.get('satici') || 'all');
  }, [searchParams]);

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    const setOrDelete = (key: string, val: string) => {
      if (val && val !== 'all') {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    };

    setOrDelete('subcategory', subcategory);
    setOrDelete('q', query);
    setOrDelete('minPrice', minPrice);
    setOrDelete('maxPrice', maxPrice);
    setOrDelete('sellerType', sellerType);

    if (category === 'property') {
      setOrDelete('location', location);
    } else {
      params.delete('location');
    }

    if (category === 'vehicle') {
      setOrDelete('brand', brand);
      setOrDelete('model', model);
      setOrDelete('minMileage', minMileage);
      setOrDelete('maxMileage', maxMileage);
      setOrDelete('turbo', turbo);
      setOrDelete('subwoofer', subwoofer);
      setOrDelete('trade', trade);
    } else {
      setOrDelete('roomCount', roomCount);
      setOrDelete('furnished', furnished);
      setOrDelete('balcony', balcony);
      setOrDelete('buildingType', buildingType);
    }

    const targetRoute = category === 'vehicle' ? '/arac' : '/mulk';
    router.push(`${targetRoute}?${params.toString()}`);
    if (onFilterChange) onFilterChange();
  };

  const resetFilters = () => {
    setSubcategory('all');
    setQuery('');
    setMinPrice('');
    setMaxPrice('');
    setLocation('all');
    setSellerType('all');
    setBrand('all');
    setModel('all');
    setMinMileage('');
    setMaxMileage('');
    setTurbo('all');
    setSubwoofer('all');
    setTrade('all');
    setRoomCount('all');
    setFurnished('all');
    setBalcony('all');
    setBuildingType('all');

    const cleanPath = category === 'vehicle' ? '/arac' : '/mulk';
    router.replace(cleanPath);
    if (onFilterChange) onFilterChange();
  };

  return (
    <div className={`surface-card p-5 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
          <Filter className="w-4 h-4 text-[#FF8A1F]" />
          <span>Filtreler</span>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="text-xs text-[var(--text-muted)] hover:text-[#FF8A1F] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Sıfırla
        </button>
      </div>

      {/* Keyword / Model Search */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          {category === 'vehicle' ? 'Model veya Kelime' : 'Mülk Ara veya Kelime'}
        </label>
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-[var(--text-dim)] pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder={category === 'vehicle' ? 'Örn: Schafter V12...' : 'Örn: Manzaralı daire...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="form-input text-xs w-full"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      {/* Subcategory */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          {category === 'vehicle' ? 'Araç Kategorisi' : 'Mülk Türü'}
        </label>
        <select
          value={subcategory}
          onChange={(e) => category === 'vehicle' ? handleSubcategoryFilterChange(e.target.value) : setSubcategory(e.target.value)}
          className="form-input text-xs"
        >
          <option value="all">Tümü</option>
          {category === 'vehicle' ? (
            <>
              {VEHICLE_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
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

      {/* Location (Properties Only) */}
      {category === 'property' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Konum</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="form-input text-xs"
          >
            <option value="all">Tüm Los Santos</option>
            {LOS_SANTOS_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Price Range */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Fiyat Aralığı ($)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min $"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="form-input text-xs"
          />
          <input
            type="number"
            placeholder="Max $"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="form-input text-xs"
          />
        </div>
      </div>

      {/* Satıcı Tipi */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Satıcı Tipi</label>
        <select
          value={sellerType}
          onChange={(e) => setSellerType(e.target.value)}
          className="form-input text-xs cursor-pointer"
        >
          <option value="all">Tümü</option>
          <option value="INDIVIDUAL">Bireysel</option>
          <option value="CORPORATE">Kurumsal</option>
        </select>
      </div>

      {/* VEHICLE-SPECIFIC FILTERS */}
      {category === 'vehicle' && (
        <>
          {/* Marka Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Marka</label>
            <select
              value={brand}
              onChange={(e) => handleBrandFilterChange(e.target.value)}
              disabled={!selectedVehicleCategory}
              className="form-input text-xs cursor-pointer"
            >
              <option value="all">Tüm Markalar</option>
              {vehicleBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Model Filter (Dependent on Marka) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!selectedVehicleCategory || brand === 'all'}
              className={`form-input text-xs cursor-pointer ${
                brand === 'all'
                  ? 'opacity-50 cursor-not-allowed bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]'
                  : ''
              }`}
            >
              <option value="all">
                {brand === 'all' ? 'Önce marka seçin' : 'Tüm Modeller'}
              </option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Mileage Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Mil</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min Mil"
                value={minMileage}
                onChange={(e) => setMinMileage(e.target.value)}
                className="form-input text-xs"
              />
              <input
                type="number"
                placeholder="Maks Mil"
                value={maxMileage}
                onChange={(e) => setMaxMileage(e.target.value)}
                className="form-input text-xs"
              />
            </div>
          </div>

          {/* Turbo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Turbo</label>
            <select
              value={turbo}
              onChange={(e) => setTurbo(e.target.value)}
              className="form-input text-xs"
            >
              <option value="all">Tümü</option>
              <option value="yes">Var</option>
              <option value="no">Yok</option>
            </select>
          </div>

          {/* Subwoofer */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Subwoofer</label>
            <select
              value={subwoofer}
              onChange={(e) => setSubwoofer(e.target.value)}
              className="form-input text-xs"
            >
              <option value="all">Tümü</option>
              <option value="yes">Var</option>
              <option value="no">Yok</option>
            </select>
          </div>

          {/* Trade / Takas */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Takasa Açık</label>
            <select
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              className="form-input text-xs"
            >
              <option value="all">Tümü</option>
              <option value="yes">Evet</option>
              <option value="no">Hayır</option>
            </select>
          </div>
        </>
      )}

      {/* PROPERTY-SPECIFIC FILTERS */}
      {category === 'property' && (
        <>
          {/* Room Count */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Oda Sayısı</label>
            <select
              value={roomCount}
              onChange={(e) => setRoomCount(e.target.value)}
              className="form-input text-xs"
            >
              <option value="all">Tümü</option>
              <option value="Stüdyo">Stüdyo</option>
              <option value="1+0">1+0</option>
              <option value="1+1">1+1</option>
              <option value="2+1">2+1</option>
              <option value="3+1">3+1</option>
              <option value="4+1">4+1</option>
              <option value="5+1+">5+1+</option>
            </select>
          </div>

          {/* Furnished */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Eşyalı</label>
            <select
              value={furnished}
              onChange={(e) => setFurnished(e.target.value)}
              className="form-input text-xs"
            >
              <option value="all">Tümü</option>
              <option value="yes">Evet</option>
              <option value="no">Hayır</option>
            </select>
          </div>

          {/* Balcony */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Balkon / Teras</label>
            <select
              value={balcony}
              onChange={(e) => setBalcony(e.target.value)}
              className="form-input text-xs"
            >
              <option value="all">Tümü</option>
              <option value="yes">Var</option>
              <option value="no">Yok</option>
            </select>
          </div>

          {/* Building Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Yapı Tipi</label>
            <select
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value)}
              className="form-input text-xs"
            >
              <option value="all">Tümü</option>
              <option value="Normal">Normal</option>
              <option value="Dubleks">Dubleks</option>
            </select>
          </div>
        </>
      )}

      {/* Apply Button */}
      <button
        type="button"
        onClick={applyFilters}
        className="w-full btn-primary text-sm py-2.5 mt-2"
      >
        Filtreleri Uygula
      </button>
    </div>
  );
}

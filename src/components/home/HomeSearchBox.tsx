'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Home, Search } from 'lucide-react';

const LOCATIONS = [
  'Vinewood',
  'Rockford Hills',
  'Vespucci',
  'Mirror Park',
  'Downtown Los Santos',
  'Del Perro',
  'Sandy Shores',
];

export function HomeSearchBox() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'vehicle' | 'property'>('vehicle');

  // Vehicle states
  const [vCategory, setVCategory] = useState('all');
  const [vQuery, setVQuery] = useState('');
  const [vMinPrice, setVMinPrice] = useState('');
  const [vMaxPrice, setVMaxPrice] = useState('');

  // Property states
  const [pLocation, setPLocation] = useState('all');
  const [pType, setPType] = useState('all');
  const [pMinPrice, setPMinPrice] = useState('');
  const [pMaxPrice, setPMaxPrice] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'vehicle') {
      const params = new URLSearchParams();
      if (vCategory !== 'all') params.set('subcategory', vCategory);
      if (vQuery) params.set('q', vQuery);
      if (vMinPrice) params.set('minPrice', vMinPrice);
      if (vMaxPrice) params.set('maxPrice', vMaxPrice);
      router.push(`/arac?${params.toString()}`);
    } else {
      const params = new URLSearchParams();
      if (pLocation !== 'all') params.set('location', pLocation);
      if (pType !== 'all') params.set('subcategory', pType);
      if (pMinPrice) params.set('minPrice', pMinPrice);
      if (pMaxPrice) params.set('maxPrice', pMaxPrice);
      router.push(`/mulk?${params.toString()}`);
    }
  };

  return (
    <div className="surface-card shadow-2xl rounded-2xl overflow-hidden border border-[var(--border-app)] text-left">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/60">
        <button
          type="button"
          onClick={() => setActiveTab('vehicle')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'vehicle'
              ? 'border-[#FF8A1F] text-[#FF8A1F] bg-[var(--bg-surface)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Araç Ara</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('property')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'property'
              ? 'border-[#FF8A1F] text-[#FF8A1F] bg-[var(--bg-surface)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Mülk Ara</span>
        </button>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSearch} className="p-4 sm:p-6 bg-[var(--bg-surface)]">
        {activeTab === 'vehicle' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Araç Kategorisi
              </label>
              <select
                value={vCategory}
                onChange={(e) => setVCategory(e.target.value)}
                className="form-input text-xs"
              >
                <option value="all">Tüm Kategoriler</option>
                <option value="Otomobil">Otomobil</option>
                <option value="SUV / Off-Road / Kamyonet">SUV / Off-Road / Kamyonet</option>
                <option value="Motosiklet">Motosiklet</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Model veya Kelime
              </label>
              <input
                type="text"
                placeholder="Örn: Schafter, Sentinel..."
                value={vQuery}
                onChange={(e) => setVQuery(e.target.value)}
                className="form-input text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Fiyat Aralığı ($)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min $"
                  value={vMinPrice}
                  onChange={(e) => setVMinPrice(e.target.value)}
                  className="form-input text-xs"
                />
                <input
                  type="number"
                  placeholder="Max $"
                  value={vMaxPrice}
                  onChange={(e) => setVMaxPrice(e.target.value)}
                  className="form-input text-xs"
                />
              </div>
            </div>

            <button type="submit" className="w-full btn-primary text-sm py-2.5">
              <Search className="w-4 h-4" />
              <span>İlanları Ara</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Konum
              </label>
              <select
                value={pLocation}
                onChange={(e) => setPLocation(e.target.value)}
                className="form-input text-xs"
              >
                <option value="all">Tüm Bölgeler</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Mülk Türü
              </label>
              <select
                value={pType}
                onChange={(e) => setPType(e.target.value)}
                className="form-input text-xs"
              >
                <option value="all">Tüm Mülkler</option>
                <option value="Ev / Daire">Ev / Daire</option>
                <option value="İşyeri">İşyeri</option>
                <option value="Diğer Mülk">Diğer Mülk</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Fiyat Aralığı ($)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min $"
                  value={pMinPrice}
                  onChange={(e) => setPMinPrice(e.target.value)}
                  className="form-input text-xs"
                />
                <input
                  type="number"
                  placeholder="Max $"
                  value={pMaxPrice}
                  onChange={(e) => setPMaxPrice(e.target.value)}
                  className="form-input text-xs"
                />
              </div>
            </div>

            <button type="submit" className="w-full btn-primary text-sm py-2.5">
              <Search className="w-4 h-4" />
              <span>İlanları Ara</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

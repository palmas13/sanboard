'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ComparePreviewItem } from './CompareContext';

export const MAX_PROPERTY_COMPARE_ITEMS = 3;
const IDS_KEY = 'sanboard_compare_property_ids';
const PREVIEWS_KEY = 'sanboard_compare_property_previews';

interface PropertyCompareValue {
  compareIds: string[];
  previews: Record<string, ComparePreviewItem>;
  addToCompare: (item: ComparePreviewItem) => { success: boolean; reason?: 'ALREADY_ADDED' | 'LIMIT_REACHED' };
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
}

const PropertyCompareContext = createContext<PropertyCompareValue | null>(null);

export function addPropertyCompareItem(ids: string[], id: string) {
  if (ids.includes(id)) return { ids, success: false as const, reason: 'ALREADY_ADDED' as const };
  if (ids.length >= MAX_PROPERTY_COMPARE_ITEMS) return { ids, success: false as const, reason: 'LIMIT_REACHED' as const };
  return { ids: [...ids, id], success: true as const };
}

export function PropertyCompareProvider({ children }: { children: React.ReactNode }) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, ComparePreviewItem>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem(IDS_KEY) || '[]');
      const savedPreviews = JSON.parse(localStorage.getItem(PREVIEWS_KEY) || '{}');
      if (Array.isArray(ids)) setCompareIds(Array.from(new Set(ids)).slice(0, MAX_PROPERTY_COMPARE_ITEMS));
      if (savedPreviews && typeof savedPreviews === 'object') setPreviews(savedPreviews);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(IDS_KEY, JSON.stringify(compareIds));
    localStorage.setItem(PREVIEWS_KEY, JSON.stringify(previews));
  }, [compareIds, previews, hydrated]);

  const addToCompare = useCallback((item: ComparePreviewItem) => {
    const result = addPropertyCompareItem(compareIds, item.id);
    if (!result.success) return result;
    setCompareIds(result.ids);
    setPreviews((current) => ({ ...current, [item.id]: item }));
    return { success: true };
  }, [compareIds]);

  const removeFromCompare = useCallback((id: string) => {
    setCompareIds((current) => current.filter((item) => item !== id));
    setPreviews((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => { setCompareIds([]); setPreviews({}); }, []);
  const isInCompare = useCallback((id: string) => compareIds.includes(id), [compareIds]);

  return <PropertyCompareContext.Provider value={{ compareIds, previews, addToCompare, removeFromCompare, clearCompare, isInCompare }}>{children}</PropertyCompareContext.Provider>;
}

export function usePropertyCompare() {
  const value = useContext(PropertyCompareContext);
  if (!value) throw new Error('usePropertyCompare must be used within PropertyCompareProvider');
  return value;
}
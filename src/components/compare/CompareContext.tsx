'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface ComparePreviewItem {
  id: string;
  title: string;
  image?: string;
  price: number;
  subcategory: string;
  brand?: string;
  model?: string;
}

interface CompareContextValue {
  compareIds: string[];
  addToCompare: (item: ComparePreviewItem) => { success: boolean; reason?: string };
  removeFromCompare: (id: string) => void;
  isInCompare: (id: string) => boolean;
  clearCompare: () => void;
  isFull: boolean;
  count: number;
  toastMessage: string | null;
  clearToast: () => void;
  isTrayOpen: boolean;
  setIsTrayOpen: (open: boolean) => void;
  previews: Record<string, ComparePreviewItem>;
}

const STORAGE_KEY_IDS = 'sanboard_compare_vehicle_ids';
const STORAGE_KEY_PREVIEWS = 'sanboard_compare_vehicle_previews';
const MAX_COMPARE_ITEMS = 2;

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, ComparePreviewItem>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    try {
      const storedIdsJson = localStorage.getItem(STORAGE_KEY_IDS);
      if (storedIdsJson) {
        const parsed = JSON.parse(storedIdsJson);
        if (Array.isArray(parsed)) {
          setCompareIds(parsed.slice(0, MAX_COMPARE_ITEMS));
        }
      }

      const storedPreviewsJson = localStorage.getItem(STORAGE_KEY_PREVIEWS);
      if (storedPreviewsJson) {
        const parsed = JSON.parse(storedPreviewsJson);
        if (parsed && typeof parsed === 'object') {
          setPreviews(parsed);
        }
      }
    } catch (e) {
      console.error('Error hydrating compare state:', e);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage whenever compareIds or previews change (after initial hydration)
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY_IDS, JSON.stringify(compareIds));
      localStorage.setItem(STORAGE_KEY_PREVIEWS, JSON.stringify(previews));
    } catch (e) {
      console.error('Error saving compare state:', e);
    }
  }, [compareIds, previews, isHydrated]);

  const isInCompare = useCallback(
    (id: string) => {
      return compareIds.includes(id);
    },
    [compareIds]
  );

  const addToCompare = useCallback(
    (item: ComparePreviewItem) => {
      if (compareIds.includes(item.id)) {
        return { success: false, reason: 'ALREADY_ADDED' };
      }

      if (compareIds.length >= MAX_COMPARE_ITEMS) {
        return { success: false, reason: 'LIMIT_REACHED' };
      }

      const nextIds = [...compareIds, item.id];
      setCompareIds(nextIds);
      setPreviews((prev) => ({ ...prev, [item.id]: item }));
      setIsTrayOpen(true);

      if (nextIds.length === 2) {
        setToastMessage('2 ilan karşılaştırmaya hazır!');
      } else {
        setToastMessage(`${item.brand || item.model || item.title} karşılaştırma listesine eklendi.`);
      }

      return { success: true };
    },
    [compareIds]
  );

  const removeFromCompare = useCallback((id: string) => {
    setCompareIds((prev) => prev.filter((item) => item !== id));
    setPreviews((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
    setPreviews({});
    setIsTrayOpen(false);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const value: CompareContextValue = {
    compareIds,
    addToCompare,
    removeFromCompare,
    isInCompare,
    clearCompare,
    isFull: compareIds.length >= MAX_COMPARE_ITEMS,
    count: compareIds.length,
    toastMessage,
    clearToast,
    isTrayOpen,
    setIsTrayOpen,
    previews,
  };

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return ctx;
}

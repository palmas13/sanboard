'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useRouter } from 'next/navigation';

interface FavoriteButtonProps {
  listingId: string;
  initialCount?: number;
  initialIsFavorited?: boolean;
  size?: 'sm' | 'md';
  showCount?: boolean;
  proofText?: boolean;
  onToggle?: (isFavorited: boolean, count: number) => void;
}

// Module-level character-scoped cache to prevent 0.5s stale-prop flicker (Sections 31-33)
const favoriteStateCache = new Map<string, { isFavorited: boolean; count: number; timestamp: number }>();

export function FavoriteButton({
  listingId,
  initialCount = 0,
  initialIsFavorited = false,
  size = 'md',
  showCount = true,
  proofText = false,
  onToggle,
}: FavoriteButtonProps) {
  const { currentProfile, isAuthenticated, authStatus } = useAuth();
  const router = useRouter();

  const profileKey = currentProfile?.id || 'anon';
  const cacheKey = `${profileKey}:${listingId}`;

  const cached = favoriteStateCache.get(cacheKey) || favoriteStateCache.get(`anon:${listingId}`);
  const isCacheRecent = cached && Date.now() - cached.timestamp < 60000;

  const [isFavorited, setIsFavorited] = useState(isCacheRecent ? cached.isFavorited : initialIsFavorited);
  const [count, setCount] = useState(isCacheRecent ? cached.count : initialCount);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state if props change, respecting recent client mutations
  useEffect(() => {
    const entry = favoriteStateCache.get(cacheKey) || favoriteStateCache.get(`anon:${listingId}`);
    if (entry && Date.now() - entry.timestamp < 60000) {
      setIsFavorited(entry.isFavorited);
      setCount(entry.count);
      if (profileKey !== 'anon') {
        favoriteStateCache.set(cacheKey, entry);
      }
      return;
    }

    setIsFavorited(initialIsFavorited);
    setCount(initialCount);
  }, [initialIsFavorited, initialCount, cacheKey, listingId, profileKey]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If auth state is initializing, don't execute yet
    if (authStatus === 'loading') return;

    // If client is confirmed unauthenticated, redirect to login
    if (authStatus === 'unauthenticated' || !isAuthenticated) {
      router.push(`/giris?redirect=/ilan/${listingId}`);
      return;
    }

    if (isLoading) return;

    // Optimistic toggle
    const prevFavorited = isFavorited;
    const prevCount = count;
    const optimisticFavorited = !prevFavorited;
    const optimisticCount = prevFavorited ? Math.max(0, count - 1) : count + 1;

    setIsFavorited(optimisticFavorited);
    setCount(optimisticCount);
    const optimisticEntry = {
      isFavorited: optimisticFavorited,
      count: optimisticCount,
      timestamp: Date.now(),
    };
    favoriteStateCache.set(cacheKey, optimisticEntry);
    favoriteStateCache.set(`anon:${listingId}`, optimisticEntry);
    onToggle?.(optimisticFavorited, optimisticCount);
    setIsLoading(true);

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });

      if (res.status === 401) {
        // Conclusively unauthenticated from server: revert and redirect to login
        setIsFavorited(prevFavorited);
        setCount(prevCount);
        favoriteStateCache.delete(cacheKey);
        favoriteStateCache.delete(`anon:${listingId}`);
        router.push(`/giris?redirect=/ilan/${listingId}`);
        return;
      }

      if (!res.ok) {
        // Business error or duplicate: revert WITHOUT redirecting
        setIsFavorited(prevFavorited);
        setCount(prevCount);
        const revertEntry = {
          isFavorited: prevFavorited,
          count: prevCount,
          timestamp: Date.now(),
        };
        favoriteStateCache.set(cacheKey, revertEntry);
        favoriteStateCache.set(`anon:${listingId}`, revertEntry);
        onToggle?.(prevFavorited, prevCount);
        return;
      }

      const data = await res.json();
      const confirmedEntry = {
        isFavorited: data.isFavorited,
        count: data.count,
        timestamp: Date.now(),
      };
      setIsFavorited(data.isFavorited);
      setCount(data.count);
      favoriteStateCache.set(cacheKey, confirmedEntry);
      favoriteStateCache.set(`anon:${listingId}`, confirmedEntry);
      onToggle?.(data.isFavorited, data.count);
    } catch {
      // Network or fetch exception: revert WITHOUT redirecting
      setIsFavorited(prevFavorited);
      setCount(prevCount);
      const revertEntry = {
        isFavorited: prevFavorited,
        count: prevCount,
        timestamp: Date.now(),
      };
      favoriteStateCache.set(cacheKey, revertEntry);
      favoriteStateCache.set(`anon:${listingId}`, revertEntry);
      onToggle?.(prevFavorited, prevCount);
    } finally {
      setIsLoading(false);
    }
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  const buttonElement = (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isFavorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
        isFavorited
          ? 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)] border border-[rgba(229,72,77,0.3)]'
          : 'bg-[var(--bg-surface-secondary)]/80 backdrop-blur-sm text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-app)]'
      }`}
    >
      <Heart
        className={`${iconSizes[size]} transition-transform ${
          isFavorited ? 'fill-current scale-110' : ''
        }`}
      />
      {showCount && <span>{count}</span>}
    </button>
  );

  if (proofText) {
    return (
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Heart className="w-4 h-4 text-[#FF8A1F] fill-[#FF8A1F]/20 shrink-0" />
          <span>
            <strong className="text-[var(--text-main)]">{count} kişi</strong> bu ilanı favori listesine ekledi.
          </span>
        </div>
        {buttonElement}
      </div>
    );
  }

  return buttonElement;
}

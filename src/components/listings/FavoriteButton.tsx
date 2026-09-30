'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { readJsonResponse } from '@/lib/http/json-response';

interface FavoriteButtonProps {
  listingId: string;
  initialCount?: number;
  initialIsFavorited?: boolean;
  initialStateIsAuthoritative?: boolean;
  size?: 'sm' | 'md';
  showCount?: boolean;
  proofText?: boolean;
  onToggle?: (isFavorited: boolean, count: number) => void;
}

type FavoriteState = { isFavorited: boolean; count: number };

// Character-scoped client overlay. Public listing data remains safe to cache globally.
const favoriteStateCache = new Map<string, FavoriteState>();
const favoriteCountCache = new Map<string, number>();
const favoriteStateSubscribers = new Map<string, Set<(state: FavoriteState) => void>>();
const favoriteCountSubscribers = new Map<string, Set<(count: number) => void>>();
const hydrationQueue = new Map<string, Map<string, Set<(state: FavoriteState) => void>>>();
let hydrationScheduled = false;

function publishFavoriteState(cacheKey: string, state: FavoriteState) {
  const listingId = cacheKey.slice(cacheKey.indexOf(':') + 1);
  favoriteCountCache.set(listingId, state.count);
  favoriteStateCache.set(cacheKey, state);
  favoriteStateSubscribers.get(cacheKey)?.forEach((subscriber) => subscriber(state));
  favoriteCountSubscribers.get(listingId)?.forEach((subscriber) => subscriber(state.count));
}

function subscribeFavoriteCount(listingId: string, subscriber: (count: number) => void) {
  const subscribers = favoriteCountSubscribers.get(listingId) || new Set();
  subscribers.add(subscriber);
  favoriteCountSubscribers.set(listingId, subscribers);
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) favoriteCountSubscribers.delete(listingId);
  };
}

function subscribeFavoriteState(cacheKey: string, subscriber: (state: FavoriteState) => void) {
  const subscribers = favoriteStateSubscribers.get(cacheKey) || new Set();
  subscribers.add(subscriber);
  favoriteStateSubscribers.set(cacheKey, subscribers);
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) favoriteStateSubscribers.delete(cacheKey);
  };
}

function queueFavoriteHydration(
  profileId: string,
  listingId: string,
  onHydrated: (state: FavoriteState) => void
) {
  const profileQueue = hydrationQueue.get(profileId) || new Map();
  const callbacks = profileQueue.get(listingId) || new Set();
  callbacks.add(onHydrated);
  profileQueue.set(listingId, callbacks);
  hydrationQueue.set(profileId, profileQueue);

  if (hydrationScheduled) return;
  hydrationScheduled = true;
  queueMicrotask(async () => {
    hydrationScheduled = false;
    const batches = [...hydrationQueue.entries()];
    hydrationQueue.clear();

    await Promise.all(batches.map(async ([batchProfileId, listings]) => {
      const listingIds = [...listings.keys()];
      try {
        const response = await fetch(`/api/favorites?listingIds=${encodeURIComponent(listingIds.join(','))}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.profileId !== batchProfileId) return;
        for (const listingId of listingIds) {
          const state = data.states?.[listingId];
          if (!state) continue;
          const normalized = {
            isFavorited: Boolean(state.isFavorited),
            count: Math.max(0, Number(state.count) || 0),
          };
          publishFavoriteState(`${batchProfileId}:${listingId}`, normalized);
          listings.get(listingId)?.forEach((callback) => callback(normalized));
        }
      } catch {
        // Keep server-rendered public count if hydration temporarily fails.
      }
    }));
  });
}

export function FavoriteButton({
  listingId,
  initialCount = 0,
  initialIsFavorited = false,
  initialStateIsAuthoritative = false,
  size = 'md',
  showCount = true,
  proofText = false,
  onToggle,
}: FavoriteButtonProps) {
  const { currentProfile, isAuthenticated, authStatus } = useAuth();
  const router = useRouter();

  const profileId = currentProfile?.id;
  const cacheKey = profileId ? `${profileId}:${listingId}` : null;
  const cached = cacheKey ? favoriteStateCache.get(cacheKey) : undefined;

  const [isFavorited, setIsFavorited] = useState(cached?.isFavorited ?? initialIsFavorited);
  const [count, setCount] = useState(favoriteCountCache.get(listingId) ?? initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const mutationPendingRef = useRef(false);
  const mutationVersionRef = useRef(0);

  useEffect(() => subscribeFavoriteCount(listingId, (nextCount) => {
    if (!mutationPendingRef.current) setCount(nextCount);
  }), [listingId]);

  // Public props provide aggregate count; authenticated membership is hydrated in one batch request.
  // Private profile-scoped responses can explicitly mark both values authoritative and skip that request.
  useEffect(() => {
    const versionAtStart = mutationVersionRef.current;
    if (!cacheKey || !profileId || authStatus !== 'authenticated') {
      setIsFavorited(initialIsFavorited);
      setCount(favoriteCountCache.get(listingId) ?? initialCount);
      return;
    }

    const entry = favoriteStateCache.get(cacheKey);
    if (entry) {
      setIsFavorited(entry.isFavorited);
      setCount(favoriteCountCache.get(listingId) ?? entry.count);
    } else {
      setIsFavorited(initialIsFavorited);
      setCount(favoriteCountCache.get(listingId) ?? initialCount);
    }

    const unsubscribe = subscribeFavoriteState(cacheKey, (state) => {
      if (mutationPendingRef.current || mutationVersionRef.current !== versionAtStart) return;
      setIsFavorited(state.isFavorited);
      setCount(state.count);
    });
    if (initialStateIsAuthoritative) {
      const authoritativeState = {
        isFavorited: initialIsFavorited,
        count: Math.max(0, Number(initialCount) || 0),
      };
      publishFavoriteState(cacheKey, authoritativeState);
      setIsFavorited(authoritativeState.isFavorited);
      setCount(authoritativeState.count);
      return unsubscribe;
    }
    queueFavoriteHydration(profileId, listingId, (state) => {
      if (mutationPendingRef.current || mutationVersionRef.current !== versionAtStart) return;
      setIsFavorited(state.isFavorited);
      setCount(state.count);
    });
    return unsubscribe;
  }, [initialIsFavorited, initialCount, initialStateIsAuthoritative, cacheKey, listingId, profileId, authStatus]);

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

    if (mutationPendingRef.current) return;
    setErrorMessage('');

    // Optimistic toggle
    const prevFavorited = isFavorited;
    const prevCount = count;
    const optimisticFavorited = !prevFavorited;
    const optimisticCount = prevFavorited ? Math.max(0, count - 1) : count + 1;
    const mutationVersion = mutationVersionRef.current + 1;
    mutationVersionRef.current = mutationVersion;
    mutationPendingRef.current = true;

    setIsFavorited(optimisticFavorited);
    setCount(optimisticCount);
    const optimisticEntry = {
      isFavorited: optimisticFavorited,
      count: optimisticCount,
    };
    if (cacheKey) publishFavoriteState(cacheKey, optimisticEntry);
    onToggle?.(optimisticFavorited, optimisticCount);
    setIsLoading(true);

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, isFavorited: optimisticFavorited }),
      });

      if (res.status === 401) {
        // Conclusively unauthenticated from server: revert and redirect to login
        setIsFavorited(prevFavorited);
        setCount(prevCount);
        if (cacheKey) favoriteStateCache.delete(cacheKey);
        setErrorMessage('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
        router.push(`/giris?redirect=/ilan/${listingId}`);
        return;
      }

      let data: { isFavorited: boolean; count: number };
      try {
        data = await readJsonResponse<{ isFavorited: boolean; count: number }>(
          res,
          'Favori işlemi tamamlanamadı.'
        );
      } catch (error) {
        setIsFavorited(prevFavorited);
        setCount(prevCount);
        const revertEntry = {
          isFavorited: prevFavorited,
          count: prevCount,
        };
        if (cacheKey) publishFavoriteState(cacheKey, revertEntry);
        onToggle?.(prevFavorited, prevCount);
        setErrorMessage(error instanceof Error ? error.message : 'Favori işlemi tamamlanamadı.');
        return;
      }

      const confirmedEntry = {
        isFavorited: data.isFavorited,
        count: data.count,
      };
      setIsFavorited(data.isFavorited);
      setCount(data.count);
      if (cacheKey) publishFavoriteState(cacheKey, confirmedEntry);
      onToggle?.(data.isFavorited, data.count);
    } catch (error) {
      // Network or fetch exception: revert WITHOUT redirecting
      setIsFavorited(prevFavorited);
      setCount(prevCount);
      const revertEntry = {
        isFavorited: prevFavorited,
        count: prevCount,
      };
      if (cacheKey) publishFavoriteState(cacheKey, revertEntry);
      onToggle?.(prevFavorited, prevCount);
      setErrorMessage(error instanceof Error ? error.message : 'Favori işlemi tamamlanamadı.');
    } finally {
      if (mutationVersionRef.current === mutationVersion) mutationPendingRef.current = false;
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
      disabled={isLoading}
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

  const errorElement = errorMessage ? (
    <span role="alert" className="max-w-64 text-right text-[10px] font-semibold text-[var(--color-danger)]">
      {errorMessage}
    </span>
  ) : null;

  if (proofText) {
    return (
      <div className="flex flex-col items-end gap-1 w-full">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Heart className="w-4 h-4 text-[#FF8A1F] fill-[#FF8A1F]/20 shrink-0" />
            <span>
              <strong className="text-[var(--text-main)]">{count} kişi</strong> bu ilanı favori listesine ekledi.
            </span>
          </div>
          {buttonElement}
        </div>
        {errorElement}
      </div>
    );
  }

  return (
    <span className="relative inline-flex flex-col items-end gap-1">
      {buttonElement}
      {errorElement}
    </span>
  );
}

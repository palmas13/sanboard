'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useRouter } from 'next/navigation';

interface FavoriteButtonProps {
  listingId: string;
  initialCount?: number;
  initialIsFavorited?: boolean;
  size?: 'sm' | 'md';
  showCount?: boolean;
  onToggle?: (isFavorited: boolean, count: number) => void;
}

export function FavoriteButton({
  listingId,
  initialCount = 0,
  initialIsFavorited = false,
  size = 'md',
  showCount = true,
  onToggle,
}: FavoriteButtonProps) {
  const { currentProfile, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state if props change (e.g. page navigation or refresh)
  React.useEffect(() => {
    setIsFavorited(initialIsFavorited);
    setCount(initialCount);
  }, [initialIsFavorited, initialCount]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated || !currentProfile) {
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
    setIsLoading(true);

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });

      if (res.status === 401) {
        router.push(`/giris?redirect=/ilan/${listingId}`);
        return;
      }

      if (!res.ok) throw new Error();
      const data = await res.json();
      setIsFavorited(data.isFavorited);
      setCount(data.count);
      onToggle?.(data.isFavorited, data.count);
    } catch {
      // Revert on error
      setIsFavorited(prevFavorited);
      setCount(prevCount);
    } finally {
      setIsLoading(false);
    }
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return (
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
}

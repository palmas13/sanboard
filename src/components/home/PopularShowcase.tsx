'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Sparkles } from 'lucide-react';
import { PublicListingSummary } from '@/types';
import { ListingCard } from '@/components/listings/ListingCard';

interface PopularShowcaseProps {
  listings: PublicListingSummary[];
}

export function PopularShowcase({ listings }: PopularShowcaseProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  // If there are few listings, duplicate them to ensure an infinite seamless track
  const duplicatedListings = React.useMemo(() => {
    if (!listings || listings.length === 0) return [];
    if (listings.length < 5) {
      return [...listings, ...listings, ...listings, ...listings];
    }
    return [...listings, ...listings];
  }, [listings]);

  // Smooth continuous auto-scroll using requestAnimationFrame
  const step = useCallback(() => {
    const el = scrollRef.current;
    if (el && !isPaused) {
      // 0.6px per frame for a smooth, premium drift
      el.scrollLeft += 0.65;

      // When we've scrolled past half the content (the first copy), seamlessly jump back
      const halfWidth = el.scrollWidth / 2;
      if (el.scrollLeft >= halfWidth) {
        el.scrollLeft -= halfWidth;
      }
    }
    animationFrameRef.current = requestAnimationFrame(step);
  }, [isPaused]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [step]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = 320;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!listings || listings.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 relative">
      {/* Header with Title, Badge, and Manual Controls */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-app)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FF8A1F]" />
              <span>Popüler İlanlar</span>
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[rgba(255,138,31,0.25)]">
              <Sparkles className="w-3 h-3" />
              Canlı Vitrin
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Topluluk tarafından en çok ilgi gören ve favorilenen vitrin ilanları
          </p>
        </div>

        {/* Left / Right Navigation Arrows */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-[var(--text-main)] hover:text-[#FF8A1F] flex items-center justify-center transition-colors shadow-sm"
            aria-label="Önceki vitrin ilanları"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-[var(--text-main)] hover:text-[#FF8A1F] flex items-center justify-center transition-colors shadow-sm"
            aria-label="Sonraki vitrin ilanları"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Showcase Track with Left/Right Gradient Fade Masks */}
      <div
        className="relative group/track overflow-hidden py-1"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Left Fade Mask */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-[var(--bg-app)] to-transparent z-10" />

        {/* Right Fade Mask */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-[var(--bg-app)] to-transparent z-10" />

        {/* Scrolling Container */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scrollbar-none scroll-smooth pb-2 pt-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {duplicatedListings.map((listing, index) => (
            <div
              key={`${listing.id}-${index}`}
              className="w-[280px] sm:w-[310px] shrink-0 transform transition-transform duration-200 hover:-translate-y-1"
            >
              <ListingCard listing={listing} className="h-full shadow-md" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

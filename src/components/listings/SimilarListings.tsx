'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { SimilarListingSummary } from '@/types';
import { SimilarListingCard } from './SimilarListingCard';

interface SimilarListingsProps {
  listings: SimilarListingSummary[];
  className?: string;
}

const AUTOPLAY_INTERVAL_MS = 5_500;
const INTERACTION_PAUSE_MS = 8_000;

export function SimilarListings({ listings, className = '' }: SimilarListingsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateBoundaries = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    setCanScrollBack(element.scrollLeft > 2);
    setCanScrollForward(element.scrollLeft < maxScrollLeft - 2);
  }, []);

  const pauseAfterInteraction = useCallback(() => {
    setIsInteracting(true);
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => setIsInteracting(false), INTERACTION_PAUSE_MS);
  }, []);

  const scrollByCard = useCallback((direction: -1 | 1, automatic = false) => {
    const element = scrollRef.current;
    if (!element) return;
    const card = element.querySelector<HTMLElement>('[data-similar-card]');
    const distance = (card?.offsetWidth || 350) + 16;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);

    if (automatic && direction === 1 && element.scrollLeft >= maxScrollLeft - 2) {
      element.scrollTo({ left: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      return;
    }

    element.scrollBy({ left: direction * distance, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (!automatic) pauseAfterInteraction();
  }, [pauseAfterInteraction, reducedMotion]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    updateBoundaries();
    const resizeObserver = new ResizeObserver(updateBoundaries);
    resizeObserver.observe(element);
    element.addEventListener('scroll', updateBoundaries, { passive: true });
    return () => {
      resizeObserver.disconnect();
      element.removeEventListener('scroll', updateBoundaries);
    };
  }, [listings.length, updateBoundaries]);

  useEffect(() => {
    if (reducedMotion || isHovering || isFocusWithin || isInteracting || listings.length < 2) return;
    const interval = window.setInterval(() => scrollByCard(1, true), AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isFocusWithin, isHovering, isInteracting, listings.length, reducedMotion, scrollByCard]);

  useEffect(() => () => {
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
  }, []);

  if (!listings.length) return null;

  return (
    <section
      data-testid="similar-listings-section"
      aria-labelledby="similar-listings-title"
      className={`surface-card overflow-hidden rounded-2xl border border-[var(--border-app)] p-5 shadow-sm sm:p-6 ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocusWithin(false);
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[#FF8A1F]" aria-hidden="true" />
            <h2 id="similar-listings-title" className="text-base font-bold text-[var(--text-main)] sm:text-lg">
              Benzer İlanlar
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Aynı kategorideki ilgili ilanlar</p>
        </div>

        {listings.length > 1 ? (
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <button type="button" onClick={() => scrollByCard(-1)} disabled={!canScrollBack} aria-label="Önceki benzer ilanlar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] text-[var(--text-muted)] transition-colors hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] disabled:cursor-not-allowed disabled:opacity-35">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => scrollByCard(1)} disabled={!canScrollForward} aria-label="Sonraki benzer ilanlar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] text-[var(--text-muted)] transition-colors hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] disabled:cursor-not-allowed disabled:opacity-35">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        data-testid="similar-listings-carousel"
        tabIndex={0}
        aria-label="Benzer ilanlar yatay listesi"
        onPointerDown={pauseAfterInteraction}
        onTouchStart={pauseAfterInteraction}
        onWheel={pauseAfterInteraction}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            scrollByCard(1);
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            scrollByCard(-1);
          }
        }}
        className="themed-scrollbar mt-4 flex max-w-full snap-x snap-mandatory items-stretch gap-4 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]"
      >
        {listings.map((listing) => (
          <div key={listing.id} data-similar-card className="snap-start">
            <SimilarListingCard listing={listing} />
          </div>
        ))}
      </div>
    </section>
  );
}
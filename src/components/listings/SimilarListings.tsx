'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { PublicListingSummary } from '@/types';
import { SimilarListingCard } from './SimilarListingCard';

interface SimilarListingsProps {
  listings: PublicListingSummary[];
  className?: string;
}

export function SimilarListings({ listings, className = '' }: SimilarListingsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!listings || listings.length === 0) {
    return null;
  }

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  return (
    <section
      ref={containerRef}
      className={`surface-card p-5 sm:p-6 rounded-2xl border border-[var(--border-app)] space-y-4 shadow-sm transition-all duration-700 ease-out motion-reduce:transition-none ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 motion-reduce:opacity-100 motion-reduce:translate-y-0'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF8A1F]" />
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)]">
              Benzer İlanlar
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Aynı kategori, marka, model ve bütçeye yakın diğer seçenekler
          </p>
        </div>

        {/* Carousel Arrow Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={scrollLeft}
            aria-label="Önceki benzer ilanlar"
            className="p-1.5 rounded-lg bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-[var(--text-muted)] hover:text-[#FF8A1F] hover:border-[#FF8A1F]/40 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={scrollRight}
            aria-label="Sonraki benzer ilanlar"
            className="p-1.5 rounded-lg bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-[var(--text-muted)] hover:text-[#FF8A1F] hover:border-[#FF8A1F]/40 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards Carousel Container */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[var(--border-app)] scrollbar-track-transparent snap-x snap-mandatory"
      >
        {listings.map((item, index) => {
          const delayMs = index * 50;
          return (
            <div
              key={item.id}
              className="snap-start transition-all duration-500 motion-reduce:transition-none"
              style={{
                transitionDelay: isVisible ? `${delayMs}ms` : '0ms',
              }}
            >
              <SimilarListingCard listing={item} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

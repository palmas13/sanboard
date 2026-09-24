'use client';

import React, { useState } from 'react';
import { ListingImage } from '@/types';
import { Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ListingGalleryProps {
  images: ListingImage[];
  title: string;
  isLocked?: boolean;
}

export function ListingGallery({ images, title, isLocked = false }: ListingGalleryProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const fallbackImage =
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=900&auto=format&fit=crop&q=80';

  const validImages = images.length > 0 ? images : [
    {
      id: 'fallback-1',
      listing_id: '',
      storage_path: fallbackImage,
      sort_order: 0,
      is_cover: true,
      size_bytes: 800000,
      created_at: '',
    },
  ];

  // If locked, only allow viewing the cover photo
  const visibleImages = isLocked ? [validImages[0]] : validImages;
  const currentImage = visibleImages[selectedIdx] || visibleImages[0];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIdx((prev) => (prev + 1) % visibleImages.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIdx((prev) => (prev - 1 + visibleImages.length) % visibleImages.length);
  };

  return (
    <div className="space-y-3">
      {/* Main Cover Display */}
      <div
        onClick={() => !isLocked && setLightboxOpen(true)}
        className={`relative aspect-[16/10] w-full rounded-2xl overflow-hidden border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] group ${
          !isLocked ? 'cursor-pointer' : ''
        }`}
      >
        <img
          src={currentImage.storage_path}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
        />

        {!isLocked && (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="p-2.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
              <Eye className="w-5 h-5" />
            </span>
          </div>
        )}

        {isLocked && (
          <div className="absolute top-3 left-3 badge-tag bg-black/60 backdrop-blur-md text-white border-white/10 text-xs">
            Vitrin Fotoğrafı
          </div>
        )}
      </div>

      {/* Thumbnails (Only if not locked and multiple images exist) */}
      {!isLocked && visibleImages.length > 1 && (
        <div className="grid grid-cols-3 gap-2.5">
          {visibleImages.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                selectedIdx === idx
                  ? 'border-[#FF8A1F] ring-2 ring-[#FF8A1F]/30'
                  : 'border-[var(--border-app)] hover:border-[var(--border-app-hover)] opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={img.storage_path}
                alt={`${title} - ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {visibleImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <img
            src={currentImage.storage_path}
            alt={title}
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

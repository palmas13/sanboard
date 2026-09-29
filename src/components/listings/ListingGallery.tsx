'use client';

import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, ImageIcon, X } from 'lucide-react';
import type { ListingImage } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { sortListingImages } from '@/lib/listings/images';

export function ListingGallery({ images, title, isLocked = false, variant = 'vehicle' }: { images: ListingImage[]; title: string; isLocked?: boolean; variant?: 'vehicle' | 'property' }) {
  const validImages = useMemo(() => sortListingImages(images), [images]);
  const visibleImages = isLocked ? validImages.slice(0, 1) : validImages;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const currentImage = visibleImages[selectedIdx] || visibleImages[0];
  const move = (direction: number) => setSelectedIdx((current) => (current + direction + visibleImages.length) % visibleImages.length);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false);
      if (event.key === 'ArrowLeft' && visibleImages.length > 1) move(-1);
      if (event.key === 'ArrowRight' && visibleImages.length > 1) move(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, visibleImages.length]);

  if (!currentImage) return <div className={`flex w-full items-center justify-center rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-muted)] ${variant === 'property' ? 'aspect-[4/3]' : 'aspect-[16/10]'}`}><ImageIcon className="mr-2 h-5 w-5" />Fotoğraf bulunamadı</div>;
  const imageUrl = resolveMediaUrl(currentImage.storage_path);
  const aspect = variant === 'property' ? 'aspect-[4/3] lg:aspect-[16/11]' : 'aspect-[16/10]';

  return <div data-testid="listing-gallery" className="space-y-3">
    <div className={`group relative w-full overflow-hidden rounded-2xl border border-white/8 bg-black/30 shadow-[0_22px_70px_rgba(0,0,0,.25)] ${aspect}`}>
      <button type="button" aria-label="Fotoğrafı tam ekran aç" disabled={isLocked} onClick={() => setLightboxOpen(true)} className="absolute inset-0 z-10 disabled:cursor-default" />
      <Image src={imageUrl} alt={title} fill priority quality={90} sizes={variant === 'property' ? '(min-width: 1024px) 58vw, 100vw' : '(min-width: 1280px) 48vw, (min-width: 768px) 65vw, 100vw'} className="object-cover" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-black/55 to-transparent" />
      <span className="absolute bottom-3 left-3 z-30 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">{selectedIdx + 1} / {visibleImages.length}</span>
      {!isLocked ? <span className="absolute right-3 top-3 z-30 rounded-full border border-white/10 bg-black/60 p-2 text-white backdrop-blur-md"><Expand className="h-4 w-4" /></span> : <span className="absolute left-3 top-3 z-30 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white">Vitrin Fotoğrafı</span>}
      {visibleImages.length > 1 ? <><button type="button" aria-label="Önceki fotoğraf" onClick={(event) => { event.stopPropagation(); move(-1); }} className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2.5 text-white backdrop-blur-md transition hover:border-[#FF8A1F]/50 hover:text-[#FF9E45]"><ChevronLeft className="h-5 w-5" /></button><button type="button" aria-label="Sonraki fotoğraf" onClick={(event) => { event.stopPropagation(); move(1); }} className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2.5 text-white backdrop-blur-md transition hover:border-[#FF8A1F]/50 hover:text-[#FF9E45]"><ChevronRight className="h-5 w-5" /></button></> : null}
    </div>
    {!isLocked && visibleImages.length > 1 ? <div className="flex gap-2.5 overflow-x-auto pb-1" aria-label="İlan fotoğrafları">{visibleImages.map((image, index) => <button key={image.id} type="button" onClick={() => setSelectedIdx(index)} aria-label={`${index + 1}. fotoğrafı göster`} aria-current={selectedIdx === index} className={`relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-xl border-2 transition sm:w-28 ${selectedIdx === index ? 'border-[#FF8A1F] opacity-100' : 'border-transparent opacity-60 hover:opacity-90'}`}><Image src={resolveMediaUrl(image.storage_path)} alt={`${title} - ${index + 1}`} fill quality={72} sizes="112px" className="object-cover" /></button>)}</div> : null}
    {lightboxOpen ? <div role="dialog" aria-modal="true" aria-label="Fotoğraf görüntüleyici" onClick={() => setLightboxOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"><button type="button" aria-label="Görüntüleyiciyi kapat" onClick={() => setLightboxOpen(false)} className="absolute right-5 top-5 z-20 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"><X className="h-6 w-6" /></button><span className="absolute left-5 top-5 z-20 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white">{selectedIdx + 1} / {visibleImages.length}</span>{visibleImages.length > 1 ? <><button type="button" aria-label="Önceki fotoğraf" onClick={(event) => { event.stopPropagation(); move(-1); }} className="absolute left-3 z-20 rounded-full bg-white/10 p-3 text-white hover:bg-[#FF8A1F]/80 sm:left-6"><ChevronLeft className="h-7 w-7" /></button><button type="button" aria-label="Sonraki fotoğraf" onClick={(event) => { event.stopPropagation(); move(1); }} className="absolute right-3 z-20 rounded-full bg-white/10 p-3 text-white hover:bg-[#FF8A1F]/80 sm:right-6"><ChevronRight className="h-7 w-7" /></button></> : null}<div className="relative h-[85vh] w-[90vw]" onClick={(event) => event.stopPropagation()}><Image src={imageUrl} alt={title} fill quality={95} sizes="90vw" className="object-contain" /></div></div> : null}
  </div>;
}

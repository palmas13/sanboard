'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react';
import type { ListingImage } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getGalleryPreloadPlan } from '@/lib/listings/gallery-preload';
import { sortListingImages } from '@/lib/listings/images';

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

interface IdleCallbacks {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
}

function hasConstrainedConnection(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return connection?.saveData === true || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
}

export function ListingGallery({ images, title, isLocked = false, variant = 'vehicle' }: { images: ListingImage[]; title: string; isLocked?: boolean; variant?: 'vehicle' | 'property' }) {
  const validImages = useMemo(() => sortListingImages(images), [images]);
  const visibleImages = isLocked ? validImages.slice(0, 1) : validImages;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const preloadStartedRef = useRef(false);
  const preloadedUrlsRef = useRef(new Set<string>());
  const cancelDeferredPreloadRef = useRef<(() => void) | null>(null);
  const currentImage = visibleImages[selectedIdx] || visibleImages[0];
  const imageUrls = useMemo(() => visibleImages.map((image) => resolveMediaUrl(image.storage_path)), [visibleImages]);
  const aspect = variant === 'property' ? 'aspect-[16/10] xl:aspect-[16/9]' : 'aspect-[16/10] xl:aspect-[16/9.25]';
  const desktopVehicleHeight = variant === 'vehicle' ? 'lg:h-full lg:aspect-auto' : '';
  const move = useCallback((direction: number) => setSelectedIdx((current) => (current + direction + visibleImages.length) % visibleImages.length), [visibleImages.length]);

  const preloadUrls = useCallback((urls: string[]) => {
    if (typeof window === 'undefined' || typeof window.Image === 'undefined') return;

    for (const url of urls) {
      if (!url || preloadedUrlsRef.current.has(url)) continue;
      preloadedUrlsRef.current.add(url);
      const image = new window.Image();
      image.decoding = 'async';
      image.src = url;
    }
  }, []);

  const startGalleryPreload = useCallback(() => {
    if (selectedIdx !== 0 || preloadStartedRef.current || imageUrls.length <= 1) return;
    preloadStartedRef.current = true;

    const plan = getGalleryPreloadPlan(imageUrls, 0, variant, hasConstrainedConnection());
    preloadUrls(plan.immediate);

    if (plan.deferred.length === 0) return;

    const idleCallbacks = window as unknown as IdleCallbacks;
    if (idleCallbacks.requestIdleCallback) {
      const idleId = idleCallbacks.requestIdleCallback(() => preloadUrls(plan.deferred), { timeout: 2000 });
      cancelDeferredPreloadRef.current = () => idleCallbacks.cancelIdleCallback?.(idleId);
      return;
    }

    const timeoutId = setTimeout(() => preloadUrls(plan.deferred), 750);
    cancelDeferredPreloadRef.current = () => clearTimeout(timeoutId);
  }, [imageUrls, preloadUrls, selectedIdx, variant]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false);
      if (event.key === 'ArrowLeft' && visibleImages.length > 1) move(-1);
      if (event.key === 'ArrowRight' && visibleImages.length > 1) move(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, move, visibleImages.length]);

  useEffect(() => () => cancelDeferredPreloadRef.current?.(), []);

  if (!currentImage) return <div className={`flex w-full items-center justify-center rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-muted)] ${aspect} ${desktopVehicleHeight}`}><ImageIcon className="mr-2 h-5 w-5" />Fotoğraf bulunamadı</div>;
  const imageUrl = resolveMediaUrl(currentImage.storage_path);

  return <div data-testid="listing-gallery" className={desktopVehicleHeight}>
    <div aria-label="İlan fotoğrafları" className={`group relative w-full overflow-hidden rounded-2xl border border-white/8 bg-black/30 shadow-[0_18px_55px_rgba(0,0,0,.2)] ${aspect} ${desktopVehicleHeight}`}>
      <button type="button" aria-label="Fotoğrafı tam ekran aç" disabled={isLocked} onClick={() => setLightboxOpen(true)} className="absolute inset-0 z-10 disabled:cursor-default" />
      <Image src={imageUrl} alt={title} fill priority unoptimized onLoad={startGalleryPreload} sizes={variant === 'property' ? '(min-width: 1280px) 52vw, 100vw' : '(min-width: 1440px) 47vw, (min-width: 1280px) 45vw, (min-width: 768px) 100vw, 100vw'} className="object-cover" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-black/55 to-transparent" />
      <span className="absolute bottom-2.5 left-2.5 z-30 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">{selectedIdx + 1} / {visibleImages.length}</span>
      {isLocked ? <span className="absolute left-3 top-3 z-30 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white">Vitrin Fotoğrafı</span> : null}
      {visibleImages.length > 1 ? <><button type="button" aria-label="Önceki fotoğraf" onClick={(event) => { event.stopPropagation(); move(-1); }} className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2.5 text-white backdrop-blur-md transition hover:border-[#FF8A1F]/50 hover:text-[#FF9E45]"><ChevronLeft className="h-5 w-5" /></button><button type="button" aria-label="Sonraki fotoğraf" onClick={(event) => { event.stopPropagation(); move(1); }} className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2.5 text-white backdrop-blur-md transition hover:border-[#FF8A1F]/50 hover:text-[#FF9E45]"><ChevronRight className="h-5 w-5" /></button></> : null}
    </div>
    {lightboxOpen ? <div role="dialog" aria-modal="true" aria-label="Fotoğraf görüntüleyici" onClick={() => setLightboxOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"><button type="button" aria-label="Görüntüleyiciyi kapat" onClick={() => setLightboxOpen(false)} className="absolute right-5 top-5 z-20 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"><X className="h-6 w-6" /></button><span className="absolute left-5 top-5 z-20 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white">{selectedIdx + 1} / {visibleImages.length}</span>{visibleImages.length > 1 ? <><button type="button" aria-label="Önceki fotoğraf" onClick={(event) => { event.stopPropagation(); move(-1); }} className="absolute left-3 z-20 rounded-full bg-white/10 p-3 text-white hover:bg-[#FF8A1F]/80 sm:left-6"><ChevronLeft className="h-7 w-7" /></button><button type="button" aria-label="Sonraki fotoğraf" onClick={(event) => { event.stopPropagation(); move(1); }} className="absolute right-3 z-20 rounded-full bg-white/10 p-3 text-white hover:bg-[#FF8A1F]/80 sm:right-6"><ChevronRight className="h-7 w-7" /></button></> : null}<div className="relative h-[85vh] w-[90vw]" onClick={(event) => event.stopPropagation()}><Image src={imageUrl} alt={title} fill unoptimized sizes="90vw" className="object-contain" /></div></div> : null}
  </div>;
}

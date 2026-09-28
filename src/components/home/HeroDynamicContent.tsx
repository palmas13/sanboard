'use client';

import { useEffect, useState } from 'react';
import type { HomepageStats } from '@/lib/db/homepage-stats';

const phrases = ['ilan oluştur', 'hayalini bul', 'fırsatları keşfet'] as const;

function formatMetric(value: number) {
  return new Intl.NumberFormat('tr-TR', { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

function CountUp({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayed(value);
      return;
    }

    const duration = 1000;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="hero-stat-value">{formatMetric(displayed)}</span>;
}

export function HeroTypewriter() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [length, setLength] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setLength(phrases[0].length);
      return;
    }

    const phrase = phrases[phraseIndex];
    const complete = length === phrase.length;
    const empty = length === 0;
    const delay = deleting ? (empty ? 240 : 42) : (complete ? 1250 : 72);
    const timer = window.setTimeout(() => {
      if (!deleting && complete) setDeleting(true);
      else if (deleting && empty) {
        setDeleting(false);
        setPhraseIndex((current) => (current + 1) % phrases.length);
      } else setLength((current) => current + (deleting ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [deleting, length, phraseIndex]);

  return <span className="hero-typewriter" aria-label={phrases[phraseIndex]}><span aria-hidden="true">{phrases[phraseIndex].slice(0, length)}</span><span className="hero-typewriter-cursor" aria-hidden="true" /></span>;
}

export function HeroStats({ stats }: { stats: HomepageStats }) {
  const items = [
    { value: stats.activeListings, label: 'Aktif İlan' },
    { value: stats.totalOffers, label: 'Teklif Sayısı' },
    { value: stats.totalSellers, label: 'Toplam Satıcı' },
  ];
  return <div className="hero-stats" aria-label="Sanboard platform istatistikleri">{items.map((item) => <div key={item.label} className="hero-stat"><strong><CountUp value={item.value} /></strong><span>{item.label}</span></div>)}</div>;
}
'use client';

import React, { useState, useEffect } from 'react';

const PHRASES = ['hayalini bul', 'aracını keşfet', 'mülkünü bul', 'ilanını yayınla'];
const TYPE_SPEED = 72;
const DELETE_SPEED = 38;
const HOLD_VISIBLE_MS = 1900;
const HOLD_EMPTY_MS = 260;

export function HeroTypewriter() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState(PHRASES[0]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const currentTarget = PHRASES[wordIndex];

    if (!isDeleting) {
      // Typing phase
      if (text.length < currentTarget.length) {
        const timeout = setTimeout(() => {
          setText(currentTarget.slice(0, text.length + 1));
        }, TYPE_SPEED);
        return () => clearTimeout(timeout);
      } else {
        // Fully typed, pause before deleting
        const timeout = setTimeout(() => {
          setIsDeleting(true);
        }, HOLD_VISIBLE_MS);
        return () => clearTimeout(timeout);
      }
    } else {
      // Deleting phase (backspace)
      if (text.length > 0) {
        const timeout = setTimeout(() => {
          setText(text.slice(0, -1));
        }, DELETE_SPEED);
        return () => clearTimeout(timeout);
      } else {
        // Fully deleted, short pause then move to next word
        const timeout = setTimeout(() => {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % PHRASES.length);
        }, HOLD_EMPTY_MS);
        return () => clearTimeout(timeout);
      }
    }
  }, [text, isDeleting, wordIndex, reducedMotion]);

  return (
    <h1 className="max-w-5xl text-[clamp(3rem,7vw,4.75rem)] font-black leading-[0.98] tracking-[-0.045em] text-[var(--text-main)] select-none">
      <span className="block">Los Santos&apos;ta</span>
      <span className="mt-2 inline-flex min-h-[1.04em] items-center text-left text-[#FF8A1F]">
        <span className="inline-block min-w-[15ch] sm:min-w-[16ch]">{reducedMotion ? PHRASES[0] : text}</span>
        <span
          className="hero-caret ml-1 inline-block h-[0.88em] w-[3px] rounded-full bg-[#FF8A1F]"
          aria-hidden="true"
        />
      </span>
    </h1>
  );
}

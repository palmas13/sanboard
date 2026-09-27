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
    <h1 className="mx-auto max-w-4xl select-none text-center text-[clamp(2.8rem,7vw,5rem)] font-black leading-[0.94] tracking-[-0.052em] text-[var(--text-main)]">
      <span className="block text-balance">Los Santos&apos;ta</span>
      <span className="mt-3 flex min-h-[1.04em] items-center justify-center bg-gradient-to-r from-[#FFB267] via-[#FF8A1F] to-[#E66F00] bg-clip-text text-transparent">
        <span className="inline-block w-[15ch] text-center sm:w-[16ch]">{reducedMotion ? PHRASES[0] : text}</span>
      </span>
    </h1>
  );
}

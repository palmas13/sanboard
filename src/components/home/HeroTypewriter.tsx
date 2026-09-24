'use client';

import React, { useState, useEffect } from 'react';

const WORDS = ['aradığını', 'aracını', 'evini', 'hayalini'];
const TYPE_SPEED = 90;
const DELETE_SPEED = 50;
const HOLD_VISIBLE_MS = 2200;
const HOLD_EMPTY_MS = 350;

export function HeroTypewriter() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState(WORDS[0]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setReducedMotion(true);
        return;
      }
    }
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const currentTarget = WORDS[wordIndex];

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
          setWordIndex((prev) => (prev + 1) % WORDS.length);
        }, HOLD_EMPTY_MS);
        return () => clearTimeout(timeout);
      }
    }
  }, [text, isDeleting, wordIndex, reducedMotion]);

  return (
    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text-main)] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 select-none">
      <span>San Andreas&apos;ta</span>
      <span className="inline-flex items-center text-left text-transparent bg-clip-text bg-gradient-to-r from-[#FF8A1F] via-[#FFA347] to-[#FF8A1F] min-w-[5.2ch] sm:min-w-[5.4ch]">
        <span>{text}</span>
        <span
          className="inline-block w-[2px] h-[1em] bg-[#FF8A1F] ml-0.5 rounded-full animate-pulse"
          aria-hidden="true"
        />
      </span>
      <span>bul!</span>
    </h1>
  );
}

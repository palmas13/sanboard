'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Seçiniz...',
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption[] = React.useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'string'
        ? { value: opt, label: opt }
        : opt
    );
  }, [options]);

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const items = listboxRef.current.querySelectorAll('li');
      const item = items[highlightedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optValue: string | number) => {
    onChange(String(optValue));
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        const currentIndex = normalizedOptions.findIndex((opt) => String(opt.value) === String(value));
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < normalizedOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : normalizedOptions.length - 1
        );
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
          const opt = normalizedOptions[highlightedIndex];
          if (!opt.disabled) {
            handleSelect(opt.value);
          }
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
    >
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            const currentIndex = normalizedOptions.findIndex((opt) => String(opt.value) === String(value));
            setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`w-full min-h-[44px] h-[44px] px-3.5 rounded-xl border flex items-center justify-between text-left transition-all outline-none cursor-pointer ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-[var(--bg-surface-secondary)]/50 border-[var(--border-app)]'
            : isOpen
            ? 'border-[#FF8A1F] ring-2 ring-[#FF8A1F]/20 bg-[var(--bg-surface)]'
            : 'border-[var(--border-app)] bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--text-dim)]'
        }`}
      >
        <span
          className={`text-xs sm:text-sm font-medium truncate ${
            selectedOption ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-dim)]'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-dim)] shrink-0 transition-transform duration-200 ml-2 ${
            isOpen ? 'rotate-180 text-[#FF8A1F]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <ul
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={selectId}
          className="themed-scrollbar absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-2xl p-1.5 space-y-0.5 animate-in fade-in duration-100 focus:outline-none"
        >
          {normalizedOptions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--text-dim)] text-center">
              Seçenek bulunmuyor
            </li>
          ) : (
            normalizedOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = idx === highlightedIndex;

              return (
                <li
                  key={String(opt.value)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-between transition-colors cursor-pointer select-none ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed text-[var(--text-dim)]'
                      : isSelected
                      ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F] font-bold'
                      : isHighlighted
                      ? 'bg-[var(--bg-surface-secondary)] text-[var(--text-main)]'
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-[#FF8A1F] shrink-0 ml-2" />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

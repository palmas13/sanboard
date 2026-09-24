import React from 'react';
import Link from 'next/link';

interface SanboardLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SanboardLogo({ className = '', size = 'md' }: SanboardLogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-bold tracking-tight select-none transition-opacity hover:opacity-90 ${sizeClasses[size]} ${className}`}
    >
      <div className="relative flex items-center justify-center p-1.5 rounded-lg bg-[var(--brand-orange-subtle)] border border-[rgba(255,138,31,0.25)]">
        <svg
          className={`${iconSizes[size]} text-[#FF8A1F]`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 8h10" />
          <path d="M7 12h6" />
          <path d="M7 16h4" />
        </svg>
      </div>
      <span className="flex items-center">
        <span className="text-[var(--text-main)]">San</span>
        <span className="text-[#FF8A1F]">board</span>
      </span>
    </Link>
  );
}

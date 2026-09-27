import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

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

  const markSizes = {
    sm: 26,
    md: 34,
    lg: 42,
  };

  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2.5 font-bold tracking-tight select-none ${sizeClasses[size]} ${className}`}
    >
      <div className="relative shrink-0 overflow-hidden rounded-xl border border-[#FF8A1F]/20 bg-[var(--brand-orange-subtle)] shadow-[0_4px_14px_rgba(255,138,31,0.12)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[#FF8A1F]/35">
        <Image src="/brand/sanboard-mark.png" alt="" width={markSizes[size]} height={markSizes[size]} className="block object-contain" priority={size === 'md'} />
      </div>
      <span className="flex items-center transition-opacity duration-200 group-hover:opacity-90">
        <span className="text-[var(--text-main)]">San</span>
        <span className="text-[#FF8A1F]">board</span>
      </span>
    </Link>
  );
}

import { Sparkles } from 'lucide-react';

interface FeaturedBadgeProps {
  className?: string;
}

export function FeaturedBadge({ className = '' }: FeaturedBadgeProps) {
  return (
    <span
      aria-label="Öne çıkan ilan"
      title="Öne çıkan ilan"
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/40 bg-gradient-to-br from-amber-400 to-[#FF8A1F] text-white shadow-md ${className}`}
    >
      <Sparkles aria-hidden="true" className="h-3.5 w-3.5 fill-white" />
    </span>
  );
}
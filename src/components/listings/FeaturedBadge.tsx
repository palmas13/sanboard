import { Rocket, Sparkles } from 'lucide-react';

interface FeaturedBadgeProps {
  className?: string;
  icon?: 'sparkles' | 'rocket';
}

export function FeaturedBadge({ className = '', icon = 'sparkles' }: FeaturedBadgeProps) {
  const Icon = icon === 'rocket' ? Rocket : Sparkles;

  return (
    <span
      aria-label="Öne çıkan ilan"
      title="Öne çıkan ilan"
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/40 bg-gradient-to-br from-amber-400 to-[#FF8A1F] text-white shadow-md ${className}`}
    >
      <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${icon === 'sparkles' ? 'fill-white' : ''}`} />
    </span>
  );
}

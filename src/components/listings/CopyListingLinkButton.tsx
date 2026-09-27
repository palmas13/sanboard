'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

export function CopyListingLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('textarea');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copyLink}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-xs font-semibold text-[var(--text-main)] transition-colors hover:border-[#FF8A1F]/50 hover:text-[#FF8A1F]"
      aria-label="İlan bağlantısını kopyala"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
      <span>{copied ? 'Bağlantı kopyalandı' : 'Bağlantıyı kopyala'}</span>
    </button>
  );
}
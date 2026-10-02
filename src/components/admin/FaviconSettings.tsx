'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { CheckCircle, ImageIcon, Loader2, UploadCloud } from 'lucide-react';

type Favicon = { url: string; version: string; sizeBytes: number };

function versionedFaviconUrl(favicon: Favicon) {
  const separator = favicon.url.includes('?') ? '&' : '?';
  return `${favicon.url}${separator}v=${encodeURIComponent(favicon.version)}`;
}

function updateDocumentFavicon(url: string) {
  const links = document.head.querySelectorAll<HTMLLinkElement>(
    'link[rel~="icon"]'
  );

  if (links.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = url;
    document.head.appendChild(link);
    return;
  }

  links.forEach((link) => {
    link.href = url;
  });
}

export function FaviconSettings() {
  const [favicon, setFavicon] = useState<Favicon | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/settings/favicon', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setFavicon(data.favicon))
      .catch(() => setMessage('Favicon ayarı yüklenemedi.'));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setMessage('');
    const body = new FormData();
    body.set('favicon', file);

    try {
      const response = await fetch('/api/admin/settings/favicon', {
        method: 'POST',
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Yükleme başarısız.');

      const nextFavicon = data.favicon as Favicon;
      setFavicon(nextFavicon);
      updateDocumentFavicon(versionedFaviconUrl(nextFavicon));
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setMessage('Favicon güncellendi.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Yükleme başarısız.');
    } finally {
      setBusy(false);
    }
  }

  const src = favicon ? versionedFaviconUrl(favicon) : null;

  return (
    <section className="surface-card rounded-2xl border border-[var(--border-app)] p-5" aria-labelledby="favicon-title">
      <div className="mb-4">
        <h2 id="favicon-title" className="text-sm font-bold">Site faviconu</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Tarayıcı sekmelerinde ve yer imlerinde kullanılan site simgesini yönetin.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[76px_1fr]">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]" aria-label="Favicon önizlemesi">
          {src ? <>
            {/* Tiny versioned admin preview from a runtime settings URL; native rendering is intentional. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Mevcut favicon" width={48} height={48} className="h-12 w-12 object-contain" />
          </> : <ImageIcon className="h-6 w-6 text-[var(--text-dim)]" aria-hidden="true" />}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor={inputId} className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--border-app)] p-3 hover:border-[#FF8A1F]">
            <UploadCloud className="h-5 w-5 shrink-0 text-[#FF8A1F]" aria-hidden="true" />
            <span className="min-w-0"><strong className="block truncate text-xs">{file?.name || 'Yeni görsel seçin'}</strong><small className="text-[10px] text-[var(--text-muted)]">PNG, JPEG veya WEBP · en fazla 1 MB</small></span>
          </label>
          <input ref={inputRef} id={inputId} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" required onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <p className="text-[10px] text-[var(--text-dim)]">Görsel güvenli bir 512×512 PNG&apos;ye dönüştürülür. ICO bu dönüştürücü tarafından desteklenmez.</p>
          <button className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs" disabled={busy || !file}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />}{busy ? 'Yükleniyor…' : 'Faviconu kaydet'}
          </button>
        </form>
      </div>
      {message && <p role="status" aria-live="polite" className="mt-3 text-xs text-[var(--text-muted)]">{message}</p>}
    </section>
  );
}
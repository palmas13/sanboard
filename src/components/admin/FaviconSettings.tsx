'use client';

import { FormEvent, useEffect, useState } from 'react';

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
      setMessage('Favicon güncellendi.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Yükleme başarısız.');
    } finally {
      setBusy(false);
    }
  }

  const src = favicon ? versionedFaviconUrl(favicon) : null;

  return (
    <section className="surface-card max-w-xl space-y-5 rounded-2xl border border-[var(--border-app)] p-6">
      <div>
        <h2 className="text-lg font-bold">Site faviconu</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          PNG, JPEG veya WEBP; en fazla 1 MB. Görsel güvenli bir 512×512
          PNG&apos;ye dönüştürülür. ICO bu dönüştürücü tarafından desteklenmez.
        </p>
      </div>
      {src && (
        <img
          src={src}
          alt="Mevcut favicon"
          width={64}
          height={64}
          className="rounded-xl border border-[var(--border-app)]"
        />
      )}
      <form onSubmit={submit} className="space-y-3">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <button className="btn-primary px-4 py-2" disabled={busy || !file}>
          {busy ? 'Yükleniyor…' : 'Faviconu kaydet'}
        </button>
      </form>
      {message && (
        <p role="status" className="text-sm text-[var(--text-muted)]">
          {message}
        </p>
      )}
    </section>
  );
}
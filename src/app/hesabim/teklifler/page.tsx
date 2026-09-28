'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { OfferThread } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { useOfferCenter } from '@/components/offers/OfferCenter';

const labels: Record<OfferThread['status'], string> = { ACTIVE: 'Aktif', ACCEPTED: 'Kabul edildi', REJECTED: 'Reddedildi', WITHDRAWN: 'Geri çekildi', EXPIRED: 'Süresi doldu', CLOSED: 'Kapandı' };

export default function TekliflerPage() {
  const { openThread } = useOfferCenter();
  const [box, setBox] = useState<'received' | 'sent'>('received');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<OfferThread[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const load = useCallback(async (append = false) => {
    const response = await fetch(`/api/offers?box=${box}${status ? `&status=${status}` : ''}${append && cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const data = await response.json();
    setRows((previous) => append ? [...previous, ...(data.threads || [])] : (data.threads || [])); setCursor(data.nextCursor || null);
  }, [box, cursor, status]);
  useEffect(() => {
    const loadFirstPage = async () => {
      const response = await fetch(`/api/offers?box=${box}${status ? `&status=${status}` : ''}`);
      const data = await response.json();
      setRows(data.threads || []);
      setCursor(data.nextCursor || null);
    };
    void loadFirstPage();
  }, [box, status]);
  return <div className="space-y-5"><div><h1 className="text-2xl font-black">Teklifler</h1><p className="text-sm text-[var(--text-muted)]">Aldığınız ve gönderdiğiniz yapılandırılmış fiyat teklifleri.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setBox('received')} className="btn-secondary">Aldığım Teklifler</button><button onClick={() => setBox('sent')} className="btn-secondary">Verdiğim Teklifler</button><select aria-label="Teklif durumu" value={status} onChange={(event) => setStatus(event.target.value)} className="form-input w-auto"><option value="">Tümü</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="surface-card rounded-2xl border border-[var(--border-app)] divide-y divide-[var(--border-app)]">{rows.map((thread) => <button type="button" onClick={() => openThread(thread.id)} key={thread.id} className="p-4 w-full text-left flex justify-between gap-4 hover:bg-[var(--bg-surface-secondary)]"><div><h2 className="font-bold">{thread.listing?.title}</h2><p className="text-xs text-[var(--text-muted)]">{box === 'received' ? thread.buyer?.full_name : thread.seller?.full_name} · {labels[thread.status]}</p></div><strong className="text-[#FF8A1F]">{formatCurrency(thread.current_amount)}</strong></button>)}{!rows.length && <p className="p-8 text-center text-sm text-[var(--text-muted)]">Teklif bulunmuyor.</p>}{cursor && <button onClick={() => void load(true)} className="btn-secondary m-4">Daha fazla</button>}</div></div>;
}
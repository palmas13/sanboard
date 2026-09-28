'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Handshake, Loader2, X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { OfferEvent, OfferThread } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

type OpenInput = { listingId: string; title: string; price: number; thumbnail?: string; minimum?: number | null };
type OfferCenterContext = { openForListing: (input: OpenInput) => void; openThread: (threadId: string) => void };

export const OFFER_CENTER_OPEN_THREAD_EVENT = 'sanboard:open-offer-thread';
const Context = createContext<OfferCenterContext>({ openForListing: () => undefined, openThread: () => undefined });
export const useOfferCenter = () => useContext(Context);
export function openOfferThread(threadId: string) {
  window.dispatchEvent(new CustomEvent(OFFER_CENTER_OPEN_THREAD_EVENT, { detail: { threadId } }));
}

const statusText: Record<OfferThread['status'], string> = {
  ACTIVE: 'Aktif', ACCEPTED: 'Kabul edildi', REJECTED: 'Reddedildi', WITHDRAWN: 'Geri çekildi', EXPIRED: 'Yanıt süresi doldu', CLOSED: 'İlan kapandığı için kapatıldı',
};
const closeReasonText: Record<string, string> = {
  LISTING_EXPIRED: 'İlanın süresi doldu.', LISTING_REMOVED_BY_SELLER: 'İlan satıcı tarafından kaldırıldı.', LISTING_REMOVED_BY_ADMIN: 'İlan yönetim tarafından kaldırıldı.', LISTING_SOLD: 'İlan satıldı.', LISTING_DELETED: 'İlan silindi.', LISTING_SUSPENDED: 'İlan askıya alındı.',
};

export function OfferCenterProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, currentProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<'received' | 'sent'>('received');
  const [rows, setRows] = useState<OfferThread[]>([]);
  const [thread, setThread] = useState<OfferThread | null>(null);
  const [compose, setCompose] = useState<OpenInput | null>(null);
  const [amount, setAmount] = useState('');
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated) return setUnread(0);
    const response = await fetch('/api/offers?countOnly=1');
    if (response.ok) setUnread((await response.json()).unreadCount || 0);
  }, [isAuthenticated]);
  const load = useCallback(async (append = false) => {
    const cursor = append && nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : '';
    const response = await fetch(`/api/offers?box=${box}${cursor}`);
    if (!response.ok) return;
    const data = await response.json();
    setRows((previous) => append ? [...previous, ...(data.threads || [])] : (data.threads || []));
    setNextCursor(data.nextCursor || null);
  }, [box, nextCursor]);
  const select = useCallback(async (id: string) => {
    setOpen(true); setCompose(null); setBusy(true); setError('');
    const response = await fetch(`/api/offers/${id}`);
    const data = await response.json();
    if (response.ok) {
      setThread(data.thread);
      await fetch(`/api/offers/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'READ' }) });
      await refreshUnread();
    } else setError(data.error || 'Teklif açılamadı.');
    setBusy(false);
  }, [refreshUnread]);
  const openForListing = useCallback((input: OpenInput) => {
    setCompose(input); setThread(null); setAmount(''); setError(''); setOpen(true);
  }, []);
  const openThread = useCallback((threadId: string) => { void select(threadId); }, [select]);

  useEffect(() => { void refreshUnread(); }, [refreshUnread, currentProfile?.id]);
  useEffect(() => { if (open && isAuthenticated && !compose && !thread) void load(); }, [open, box, isAuthenticated, compose, thread, load]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const onThread = (event: Event) => openThread((event as CustomEvent<{ threadId: string }>).detail.threadId);
    document.addEventListener('keydown', onKey); window.addEventListener(OFFER_CENTER_OPEN_THREAD_EVENT, onThread);
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener(OFFER_CENTER_OPEN_THREAD_EVENT, onThread); };
  }, [openThread]);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);

  const create = async () => {
    if (!compose) return;
    setBusy(true); setError('');
    const response = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: compose.listingId, amount: Number(amount) }) });
    const data = await response.json();
    if (response.ok) { setCompose(null); setThread(data.thread); setBox('sent'); setAmount(''); } else setError(data.error);
    setBusy(false);
  };
  const act = async (action: 'COUNTER' | 'ACCEPT' | 'REJECT' | 'WITHDRAW') => {
    if (!thread) return;
    setBusy(true); setError('');
    const response = await fetch(`/api/offers/${thread.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, amount: action === 'COUNTER' ? Number(amount) : undefined }) });
    const data = await response.json();
    if (response.ok) { setThread(data.thread); setAmount(''); await refreshUnread(); } else setError(data.error);
    setBusy(false);
  };
  const eventText = (event: OfferEvent) => ({ OFFER_CREATED: 'Teklif verildi', COUNTER_OFFER_CREATED: 'Karşı teklif verildi', ACCEPTED: 'Teklif kabul edildi', REJECTED: 'Teklif reddedildi', WITHDRAWN: 'Teklif geri çekildi', LISTING_PRICE_CHANGED: 'İlan fiyatı değiştirildi', THREAD_CLOSED: 'Teklif görüşmesi kapandı' }[event.event_type]);
  const canRespond = thread?.status === 'ACTIVE' && thread.turn_profile_id === currentProfile?.id;
  const canWithdraw = thread?.status === 'ACTIVE' && thread.actor_side === 'BUYER';

  return <Context.Provider value={{ openForListing, openThread }}>
    {children}
    {isAuthenticated && <>
      <button aria-label="Teklifleri aç" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-50 h-14 w-14 rounded-full bg-[#FF8A1F] text-black shadow-2xl flex items-center justify-center"><Handshake />{unread > 0 && <span aria-label={`${unread} okunmamış teklif hareketi`} className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unread}</span>}</button>
      {open && <div role="dialog" aria-modal="true" aria-label="Teklifler" className="fixed z-50 bottom-0 right-0 sm:bottom-20 sm:right-5 w-full sm:w-[400px] h-[85vh] sm:h-[620px] max-h-[calc(100vh-6rem)] pb-[env(safe-area-inset-bottom)] bg-[var(--bg-surface)] border border-[var(--border-app)] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="p-4 border-b border-[var(--border-app)] flex items-center justify-between"><div className="flex items-center gap-2">{(thread || compose) && <button aria-label="Listeye dön" onClick={() => { setThread(null); setCompose(null); setError(''); }}><ArrowLeft /></button>}<h2 className="font-bold">Teklifler</h2></div><button ref={closeButton} aria-label="Kapat" onClick={() => setOpen(false)}><X /></button></header>
        {!thread && !compose && <><div role="tablist" aria-label="Teklif kutusu" className="grid grid-cols-2 p-2 gap-2"><button role="tab" aria-selected={box === 'received'} onClick={() => setBox('received')} className="btn-secondary">Aldıklarım</button><button role="tab" aria-selected={box === 'sent'} onClick={() => setBox('sent')} className="btn-secondary">Gönderdiklerim</button></div><div className="overflow-y-auto flex-1">{rows.map((row) => <button key={row.id} onClick={() => void select(row.id)} className="w-full text-left p-4 border-t border-[var(--border-app)] hover:bg-[var(--bg-surface-secondary)]"><div className="font-bold text-sm truncate">{row.listing?.title}</div><div className="text-xs text-[var(--text-muted)]">{box === 'sent' ? row.seller?.full_name : row.buyer?.full_name} · {statusText[row.status]}</div><div className="text-[#FF8A1F] font-bold">{formatCurrency(row.current_amount)}</div></button>)}{!rows.length && <p className="p-8 text-center text-sm text-[var(--text-muted)]">Teklif bulunmuyor.</p>}{nextCursor && <button className="btn-secondary m-4 w-[calc(100%-2rem)]" onClick={() => void load(true)}>Daha fazla</button>}</div></>}
        {compose && <div className="p-5 space-y-4"><h3 className="font-bold">{compose.title}</h3><p className="text-sm">İlan fiyatı: {formatCurrency(compose.price)}</p>{compose.minimum && <p className="text-xs text-[var(--text-muted)]">Minimum teklif: {formatCurrency(compose.minimum)}</p>}<input autoFocus className="form-input w-full" inputMode="numeric" aria-label="Teklif tutarı" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} /><button disabled={busy || !amount} onClick={() => void create()} className="btn-primary w-full">{busy ? <Loader2 className="animate-spin" /> : 'Teklifi Gönder'}</button></div>}
        {thread && <div className="flex-1 overflow-y-auto p-5 space-y-4"><div><h3 className="font-bold">{thread.listing?.title}</h3><p className="text-2xl font-black text-[#FF8A1F]">{formatCurrency(thread.current_amount)}</p><p className="text-sm text-[var(--text-muted)]">{statusText[thread.status]}</p>{thread.close_reason && <p className="text-sm mt-2">{closeReasonText[thread.close_reason]}</p>}</div><div className="space-y-2">{thread.events?.map((event) => <div key={event.id} className="rounded-xl bg-[var(--bg-surface-secondary)] p-3 text-sm"><b>{eventText(event)}</b>{event.amount ? ` · ${formatCurrency(event.amount)}` : ''}</div>)}</div>{thread.status === 'ACCEPTED' && <p className="rounded-xl bg-emerald-500/10 p-3 text-sm">{formatCurrency(thread.current_amount)} teklif üzerinde anlaşıldı. İletişim ve devir işlemleri için karşı tarafla Sanboard profil bilgileri üzerinden iletişime geçebilirsiniz.</p>}{thread.status === 'ACTIVE' && <div className="space-y-2">{canRespond && <><input className="form-input w-full" inputMode="numeric" aria-label="Karşı teklif tutarı" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} /><div className="grid grid-cols-3 gap-2"><button disabled={busy || !amount || thread.movement_count >= 6} onClick={() => void act('COUNTER')} className="btn-secondary">Karşı Teklif</button><button disabled={busy} onClick={() => void act('ACCEPT')} className="btn-primary">Kabul Et</button><button disabled={busy} onClick={() => void act('REJECT')} className="btn-secondary">Reddet</button></div></>}{!canRespond && <p className="text-sm text-[var(--text-muted)]">{thread.actor_side === 'BUYER' ? 'Satıcı yanıtı bekleniyor' : 'Alıcı yanıtı bekleniyor'}</p>}{canWithdraw && <button disabled={busy} onClick={() => void act('WITHDRAW')} className="btn-secondary w-full">Teklifi Geri Çek</button>}</div>}</div>}
        {busy && !thread && !compose && <Loader2 className="m-auto animate-spin" />}{error && <p role="alert" className="p-3 text-sm text-red-400">{error}</p>}
      </div>}
    </>}
  </Context.Provider>;
}
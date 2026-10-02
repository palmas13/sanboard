'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import {
  LifeBuoy,
  PlusCircle,
  Clock,
  Send,
  Loader2,
  AlertCircle,
  ChevronRight,
  X,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';
import { SupportTicket, TicketCategory } from '@/types';
import { getTicketCategoryLabel, TICKET_CATEGORIES } from '@/lib/tickets/categories';

export default function HesabimDestekPage() {
  const { currentProfile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // New ticket fields
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const fetchTickets = useCallback(async () => {
    if (!currentProfile?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTickets(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [currentProfile?.id]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    if (!category || !subject.trim() || !message.trim()) {
      setError('Lütfen kategori, konu başlığı ve mesajınızı giriniz.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Talep oluşturulamadı.');

      setModalOpen(false);
      setCategory('');
      setSubject('');
      setMessage('');
      await fetchTickets();
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6">
      {/* Top Header */}
      <div className="pb-4 border-b border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-main)]">Destek Merkezi</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            İlanlarınız, ödemeleriniz veya platformla ilgili sorularınız için Sanboard yönetimiyle doğrudan iletişime geçin.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Yeni Talep Oluştur</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
          <span>Talepler yükleniyor...</span>
        </div>
      ) : tickets.length > 0 ? (
        <div className="divide-y divide-[var(--border-app)] border border-[var(--border-app)] rounded-xl overflow-hidden">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/hesabim/destek/${t.id}`}
              className="p-4 flex items-center justify-between gap-4 hover:bg-[var(--bg-surface-secondary)]/40 transition-colors group block"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[var(--text-dim)]">
                    {t.id}
                  </span>
                  <span className="px-2 py-0.5 rounded-full border border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)] text-[10px] font-semibold text-[#FF8A1F]">
                    {getTicketCategoryLabel(t.category)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.status === 'ANSWERED'
                        ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                        : t.status === 'OPEN'
                        ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]'
                        : 'bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]'
                    }`}
                  >
                    {t.status === 'ANSWERED'
                      ? 'Yanıtlandı'
                      : t.status === 'OPEN'
                      ? 'Açık'
                      : 'Kapatıldı'}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-[var(--text-main)] group-hover:text-[#FF8A1F] transition-colors">
                  {t.subject}
                </h4>

                <p className="text-[11px] text-[var(--text-dim)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Son güncelleme: {formatDateTime(t.updated_at)}</span>
                </p>
              </div>

              <ChevronRight className="w-5 h-5 text-[var(--text-dim)] group-hover:text-[#FF8A1F] group-hover:translate-x-1 transition-all shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-10 text-center space-y-3">
          <LifeBuoy className="w-8 h-8 text-[var(--text-dim)] mx-auto" />
          <p className="text-sm font-bold text-[var(--text-main)]">
            Henüz bir destek talebiniz bulunmuyor.
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Herhangi bir konuda yardım almak için sağ üstteki butondan yeni bir destek talebi başlatabilirsiniz.
          </p>
        </div>
      )}

      {/* NEW TICKET MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-lg w-full surface-card rounded-2xl border border-[var(--border-app)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-[#FF8A1F]" />
                <h3 className="font-bold text-base text-[var(--text-main)]">Yeni Destek Talebi</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)} required className="form-input text-sm">
                  <option value="" disabled>Kategori seçin</option>
                  {TICKET_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Konu Başlığı</label>
                <input
                  type="text"
                  placeholder="Örn: Ödeme onayı hakkında veya İlan düzenleme sorusu"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="form-input text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Mesajınız</label>
                <textarea
                  rows={4}
                  placeholder="Destek almak istediğiniz konuyu detaylı bir şekilde açıklayınız..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  className="form-input text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-app)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 shadow"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Talebi Başlat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

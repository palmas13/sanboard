'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import {
  ArrowLeft,
  Send,
  Loader2,
  Shield,
  User,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';
import { SupportTicket, TicketMessage } from '@/types';
import { getTicketCategoryLabel } from '@/lib/tickets/categories';
import { useToast } from '@/components/feedback/ToastProvider';

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const { currentProfile } = useAuth();
  const { showToast } = useToast();

  const [ticket, setTicket] = useState<(SupportTicket & { messages: TicketMessage[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) {
        setTicket(null);
        return;
      }
      const data = await res.json();
      setTicket(data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void fetchTicket();
  }, [fetchTicket]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentProfile) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: replyText.trim(),
        }),
      });

      if (!res.ok) throw new Error('Mesaj iletilemedi.');

      setReplyText('');
      await fetchTicket();
    } catch (err: any) {
      showToast(err.message || 'Mesaj iletilemedi.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!confirm('Bu destek talebini kapatmak istediğinize emin misiniz?')) return;
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Talep kapatılamadı.');
      await fetchTicket();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Talep kapatılamadı.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="surface-card p-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
        <span>Talep yükleniyor...</span>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="surface-card p-12 text-center space-y-3">
        <p className="text-sm font-bold text-[var(--text-main)]">Destek talebi bulunamadı.</p>
        <Link href="/hesabim/destek" className="btn-secondary text-xs py-2 px-4 inline-flex">
          Destek Listesine Dön
        </Link>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6">
      {/* Top Header */}
      <div className="pb-4 border-b border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/hesabim/destek"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[#FF8A1F] transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tüm Taleplerime Dön</span>
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-main)]">
              {ticket.subject}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                ticket.status === 'ANSWERED'
                  ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                  : ticket.status === 'OPEN'
                  ? 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]'
                  : 'bg-[var(--bg-surface-secondary)] text-[var(--text-dim)]'
              }`}
            >
              {ticket.status === 'ANSWERED'
                ? 'Yanıtlandı'
                : ticket.status === 'OPEN'
                ? 'Açık'
                : 'Kapatıldı'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Referans: {ticket.id} • Oluşturulma: {formatDateTime(ticket.created_at)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Kategori: <strong className="text-[#FF8A1F]">{getTicketCategoryLabel(ticket.category)}</strong></p>
        </div>

        {!isClosed && (
          <button
            type="button"
            onClick={handleCloseTicket}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--color-danger)]"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Talebi Kapat</span>
          </button>
        )}
      </div>

      {/* Message Thread History */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
        {(ticket.messages || []).map((msg) => {
          const isAdmin = msg.sender_role === 'ADMIN';

          return (
            <div
              key={msg.id}
              className={`p-4 rounded-2xl border ${
                isAdmin
                  ? 'bg-[var(--brand-orange-subtle)] border-[#FF8A1F]/30 ml-4 sm:ml-8'
                  : 'bg-[var(--bg-surface-secondary)]/50 border-[var(--border-app)] mr-4 sm:mr-8'
              } space-y-2`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <div className="flex items-center gap-1 text-[#FF8A1F] font-bold">
                      <Shield className="w-3.5 h-3.5" />
                      <span>{msg.display_author || 'Sanboard Yönetim'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[var(--text-main)] font-bold">
                      <User className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                      <span>{msg.display_author || msg.sender_name}</span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-[var(--text-dim)] font-mono">
                  {formatDateTime(msg.created_at)}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap">
                {msg.message}
              </p>
            </div>
          );
        })}
      </div>

      {/* Reply Form */}
      {isClosed ? (
        <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] text-center text-xs text-[var(--text-dim)] font-medium">
          Bu destek talebi kapatılmıştır. Yeni bir sorunuz varsa lütfen yeni bir talep oluşturunuz.
        </div>
      ) : (
        <form onSubmit={handleSendReply} className="pt-2 border-t border-[var(--border-app)] space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <textarea
              rows={3}
              placeholder="Yanıtlama mesajınızı yazınız..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              required
              className="form-input text-sm resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Cevap Gönder</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

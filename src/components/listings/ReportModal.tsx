'use client';

import React, { useState } from 'react';
import { Flag, X, Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useRouter } from 'next/navigation';

interface ReportModalProps {
  listingId: string;
}

export function ReportModal({ listingId }: ReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('Yanlış bilgi');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { currentProfile, isAuthenticated } = useAuth();
  const router = useRouter();

  const handleOpen = () => {
    if (!isAuthenticated || !currentProfile) {
      router.push(`/giris?redirect=/ilan/${listingId}`);
      return;
    }
    setIsOpen(true);
    setSuccess(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterProfileId: currentProfile.id,
          listingId,
          reason,
          description: description.trim(),
        }),
      });

      if (!res.ok) throw new Error('Şikayet iletilemedi.');

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
      >
        <Flag className="w-3.5 h-3.5" />
        <span>İlanı Şikayet Et</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full surface-card rounded-2xl border border-[var(--border-app)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
                <Flag className="w-4 h-4 text-[var(--color-danger)]" />
                <span>İlanı Şikayet Et</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {success ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[var(--color-success)] mx-auto" />
                <p className="text-sm font-bold text-[var(--text-main)]">Şikayetiniz İletildi</p>
                <p className="text-xs text-[var(--text-muted)]">
                  İnceleme Sanboard yönetim ekibi tarafından gerçekleştirilecektir.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-2.5 rounded-lg bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Şikayet Nedeni
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="form-input text-xs"
                  >
                    <option value="Yanlış bilgi">Yanlış bilgi</option>
                    <option value="Uygunsuz içerik">Uygunsuz içerik</option>
                    <option value="Şüpheli ilan">Şüpheli ilan</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Açıklama
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Şikayet sebebinizi kısaca açıklayınız..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="form-input text-xs resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-app)]">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="btn-secondary text-xs py-2 px-3.5"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-danger text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Şikayeti Gönder</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

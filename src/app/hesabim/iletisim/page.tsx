'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Phone, Mail, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function HesabimIletisimPage() {
  const { currentProfile, updateCurrentProfile, refreshProfile } = useAuth();

  const [phone, setPhone] = useState(currentProfile?.phone || '');
  const [sanmailEmail, setSanmailEmail] = useState(currentProfile?.sanmail_email || '');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentProfile) {
      setPhone(currentProfile.phone || '');
      setSanmailEmail(currentProfile.sanmail_email || '');
    }
  }, [currentProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    setError('');
    setSuccess(false);

    let formattedSanMail = sanmailEmail.trim();
    if (formattedSanMail && !formattedSanMail.includes('@')) {
      formattedSanMail = `${formattedSanMail}@sanmail.com`;
    }

    const formattedPhone = phone.trim();

    setSubmitting(true);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          phone: formattedPhone,
          sanmail_email: formattedSanMail,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'İletişim bilgileri güncellenemedi.');
      }

      updateCurrentProfile({
        phone: formattedPhone,
        sanmail_email: formattedSanMail,
      });

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6">
      <div className="pb-4 border-b border-[var(--border-app)]">
        <h2 className="text-xl font-bold text-[var(--text-main)]">İletişim Bilgilerim</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          İlanlarınızda yalnızca Sanboard üyelerinin görebileceği irtibat kanallarını yönetebilirsiniz.
        </p>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-2 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>İletişim bilgileri başarıyla güncellendi.</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2 border border-[rgba(229,72,77,0.3)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 max-w-xl">
        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[#FF8A1F]" />
            <span>Telefon Numarası</span>
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="örnek: 1308 veya 555-0100"
            className="form-input text-sm"
          />
          <p className="text-[11px] text-[var(--text-dim)]">
            GTA World IC telefon numaranız (4 haneli, 6 haneli veya standart IC numaralar kabul edilir).
          </p>
        </div>

        {/* SanMail */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#FF8A1F]" />
            <span>SanMail E-posta Adresi</span>
          </label>
          <input
            type="text"
            value={sanmailEmail}
            onChange={(e) => setSanmailEmail(e.target.value)}
            placeholder="örnek: isim.soyisim@sanmail.com"
            className="form-input text-sm"
          />
          <p className="text-[11px] text-[var(--text-dim)]">
            Alıcılar sizinle bu SanMail adresi üzerinden iletişime geçer.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary py-2.5 px-6 text-sm font-bold flex items-center gap-2"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Bilgileri Kaydet</span>
        </button>
      </form>
    </div>
  );
}

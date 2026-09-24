'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { User, Mail, Phone, Camera, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function ProfilOlusturContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const charId = searchParams.get('charId') || 'char-ravi-03';
  const redirect = searchParams.get('redirect') || '/';

  const { characters, selectCharacter } = useAuth();
  const char = characters.find((c) => c.id === charId) || {
    id: charId,
    fullName: 'Ravi Blumon',
    hasProfile: false,
    avatarUrl: '',
    sanmailEmail: 'ravi.blumon@sanmail.com',
    phone: '555-4309',
  };

  const [fullName] = useState(char.fullName);
  const [avatarUrl, setAvatarUrl] = useState(char.avatarUrl || '');
  const [sanmailEmail, setSanmailEmail] = useState(
    char.sanmailEmail || `${char.fullName.toLowerCase().replace(' ', '.')}@sanmail.com`
  );
  const [phone, setPhone] = useState(char.phone || '555-4309');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || phone.length < 5) {
      setError('Lütfen geçerli bir telefon numarası giriniz.');
      return;
    }

    if (!sanmailEmail || !sanmailEmail.includes('@')) {
      setError('Lütfen geçerli bir SanMail adresi giriniz.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create character profile in system
      char.hasProfile = true;
      char.avatarUrl = avatarUrl;
      char.sanmailEmail = sanmailEmail;
      char.phone = phone;

      selectCharacter(char.id);
      router.push(redirect);
    } catch {
      setError('Profil kaydedilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] shadow-2xl space-y-6 animate-in fade-in duration-200">
        <div>
          <Link
            href="/karakter-sec"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Karakter Seçimine Dön</span>
          </Link>
          <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
            Sanboard Profilini Oluştur
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            <span className="font-semibold text-[var(--text-main)]">{fullName}</span> karakteri için ilanlarda görünecek iletişim ve profil detaylarını belirle.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold border border-[rgba(229,72,77,0.3)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Preview & URL */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#FF8A1F] shadow-sm shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border-2 border-[#FF8A1F] flex items-center justify-center font-black text-xl shrink-0">
                {fullName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-[#FF8A1F]" />
                <span>Profil Fotoğrafı URL</span>
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="form-input text-xs"
              />
            </div>
          </div>

          {/* Full Name (Read-only as it comes from character) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[var(--text-dim)]" />
              <span>Karakter Adı (UCP)</span>
            </label>
            <input
              type="text"
              value={fullName}
              disabled
              className="form-input text-sm bg-[var(--bg-surface-secondary)] opacity-80 cursor-not-allowed font-medium"
            />
            <p className="text-[11px] text-[var(--text-dim)]">
              Karakter adı GTA World verilerinden çekilir ve değiştirilemez.
            </p>
          </div>

          {/* SanMail Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#FF8A1F]" />
              <span>SanMail Adresi</span>
            </label>
            <input
              type="email"
              value={sanmailEmail}
              onChange={(e) => setSanmailEmail(e.target.value)}
              placeholder="isim.soyisim@sanmail.com"
              required
              className="form-input text-sm"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#FF8A1F]" />
              <span>İletişim Numarası (Telefon)</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="555-0100"
              required
              className="form-input text-sm"
            />
            <p className="text-[11px] text-[var(--text-dim)]">
              İlanlarınızda yalnızca Sanboard üyelerinin görebileceği telefon numaranızdır.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 mt-4"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Kaydediliyor...' : 'Profili Kaydet ve Başla'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ProfilOlusturPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Yükleniyor...</div>}>
      <ProfilOlusturContent />
    </Suspense>
  );
}

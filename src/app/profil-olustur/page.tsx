'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { User, Mail, Phone, Camera, Save, ArrowLeft, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';

function ProfilOlusturContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const charId = searchParams.get('charId') || '';
  const redirect = searchParams.get('redirect') || '/hesabim';

  const { characters, selectCharacter } = useAuth();
  const char = characters.find((c) => c.id === charId) || {
    id: charId,
    fullName: 'Karakter',
    hasProfile: false,
    avatarUrl: '',
    sanmailEmail: '',
    phone: '',
  };

  const [fullName] = useState(char.fullName);
  const [avatarPreview, setAvatarPreview] = useState<string>(char.avatarUrl || '');
  const [avatarData, setAvatarData] = useState<string>('');
  const [sanmailEmail, setSanmailEmail] = useState(char.sanmailEmail || '');
  const [phone, setPhone] = useState(char.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let active = true;
    async function checkExistingProfile() {
      try {
        const res = await fetch(`/api/user/profile?profileId=${charId}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data.profile && active) {
            await selectCharacter(data.profile.id);
            router.push(redirect);
            return;
          }
        }
      } catch {
        // Continue to form
      }
      if (active) setCheckingExisting(false);
    }
    checkExistingProfile();
    return () => {
      active = false;
    };
  }, [charId, redirect, router, selectCharacter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      setError('SVG formatı desteklenmemektedir. Lütfen JPG, PNG veya WEBP yükleyin.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      setError('Desteklenen formatlar: JPG, JPEG, PNG, WEBP');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Dosya boyutu en fazla 5MB olabilir.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAvatarPreview(result);
      setAvatarData(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview('');
    setAvatarData('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let formattedSanMail = sanmailEmail.trim();
    if (formattedSanMail && !formattedSanMail.includes('@')) {
      formattedSanMail = `${formattedSanMail}@sanmail.com`;
    }

    const formattedPhone = phone.trim();

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: char.id,
          fullName,
          avatarData: avatarData || undefined,
          sanmailEmail: formattedSanMail || undefined,
          phone: formattedPhone || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Profil oluşturulurken bir hata oluştu.');
        setIsSubmitting(false);
        return;
      }

      // Establish client session state with newly returned profile
      await selectCharacter(data.profile.id);
      router.push(redirect);
    } catch {
      setError('Profil kaydedilirken bir bağlantı hatası oluştu.');
      setIsSubmitting(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="surface-card p-8 rounded-2xl border border-[var(--border-app)] text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-[#FF8A1F] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">Profil durumu kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

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
          {/* Avatar Upload (File Picker Only, URL Input Removed) */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] space-y-3">
            <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#FF8A1F]" />
              <span>Profil Fotoğrafı (İsteğe Bağlı)</span>
            </label>

            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={fullName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#FF8A1F] shadow-sm shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border-2 border-[#FF8A1F] flex items-center justify-center font-black text-xl shrink-0">
                  {fullName?.charAt(0) || 'U'}
                </div>
              )}

              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--border-app)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-app)] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#FF8A1F]" />
                    <span>Bilgisayardan Seç</span>
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-medium hover:opacity-80 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Kaldır</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-dim)]">
                  Desteklenen formatlar: JPG, JPEG, PNG, WEBP
                </p>
              </div>
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

          {/* SanMail Email (Starts Empty, Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#FF8A1F]" />
              <span>SanMail Adresi (İsteğe Bağlı)</span>
            </label>
            <input
              type="text"
              value={sanmailEmail}
              onChange={(e) => setSanmailEmail(e.target.value)}
              placeholder=""
              className="form-input text-sm"
            />
            <p className="text-[11px] text-[var(--text-dim)]">
              İlanlarınızda görünecek IC e-posta adresiniz. Boş bırakabilirsiniz.
            </p>
          </div>

          {/* Phone (Starts Empty, Optional, allows short IC numbers e.g. 1308) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#FF8A1F]" />
              <span>İletişim Numarası / Telefon (İsteğe Bağlı)</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder=""
              className="form-input text-sm"
            />
            <p className="text-[11px] text-[var(--text-dim)]">
              GTA World IC telefon numaranız (kısa numaralar geçerlidir). Boş bırakabilirsiniz.
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

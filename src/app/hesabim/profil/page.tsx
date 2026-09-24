'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { User, Camera, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { resolveAvatarUrl } from '@/lib/media/url';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

export default function HesabimProfilPage() {
  const { currentProfile, updateCurrentProfile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(
    currentProfile?.avatar_path || currentProfile?.avatar_url || ''
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Sync state when profile is hydrated from server
  useEffect(() => {
    if (currentProfile && !avatarFile) {
      setAvatarUrl(currentProfile.avatar_path || currentProfile.avatar_url || '');
    }
  }, [currentProfile?.avatar_path, currentProfile?.avatar_url, avatarFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (Max 2 MB)
    if (file.size > MAX_AVATAR_SIZE) {
      setError('Profil fotoğrafı maksimum 2 MB olabilir.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Yalnızca JPG, JPEG, PNG veya WEBP formatları desteklenmektedir.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAvatarFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;

    setSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          avatar_url: avatarUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Profil güncellenemedi.');
      }

      // Update auth context state with the server-persisted profile data
      if (data.profile) {
        updateCurrentProfile(data.profile);
        setAvatarUrl(data.profile.avatar_path || data.profile.avatar_url);
        setAvatarFile(null);
      }

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const [avatarImgError, setAvatarImgError] = useState(false);
  const displayAvatar = avatarFile ? avatarUrl : resolveAvatarUrl(avatarUrl);

  return (
    <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6">
      <div className="pb-4 border-b border-[var(--border-app)]">
        <h2 className="text-xl font-bold text-[var(--text-main)]">Profilim</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Karakter profil fotoğrafını ve hesap detaylarını yönetebilirsin.
        </p>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-2 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profil başarıyla güncellendi.</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2 border border-[rgba(229,72,77,0.3)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 max-w-xl">
        {/* AVATAR UPLOAD SECTION */}
        <div className="p-6 rounded-2xl bg-[var(--bg-surface-secondary)]/50 border border-[var(--border-app)] flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          {/* Circular avatar with hover camera overlay */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-[#FF8A1F] shadow-lg group cursor-pointer shrink-0 transition-transform hover:scale-105"
            title="Fotoğrafı Değiştir"
          >
            {displayAvatar && !avatarImgError ? (
              <img
                src={displayAvatar}
                alt="Karakter Avatarı"
                onError={() => setAvatarImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center font-black text-3xl">
                {currentProfile?.full_name?.charAt(0) || 'U'}
              </div>
            )}
            {/* Hover overlay with camera icon */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1">
              <Camera className="w-6 h-6 text-[#FF8A1F]" />
              <span className="text-[10px] font-bold">Değiştir</span>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Karakter Profil Fotoğrafı
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Maksimum <strong className="text-[var(--text-main)]">2 MB</strong> dosya boyutu
              </p>
              <p className="text-[11px] text-[var(--text-dim)]">
                Desteklenen formatlar: JPG, JPEG, PNG, WEBP
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs py-2 px-3.5 inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-[#FF8A1F]" />
                <span>Fotoğraf Seç</span>
              </button>
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg, image/jpg, image/png, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Karakter Adı */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[var(--text-dim)]" />
            <span>Karakter Ad Soyad (UCP)</span>
          </label>
          <input
            type="text"
            value={currentProfile?.full_name || ''}
            disabled
            className="form-input text-sm bg-[var(--bg-surface-secondary)] opacity-80 cursor-not-allowed font-semibold"
          />
          <p className="text-[11px] text-[var(--text-dim)]">
            Karakter adı GTA World veritabanına bağlıdır ve değiştirilemez.
          </p>
        </div>

        {/* Creation Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Kayıt Tarihi</label>
          <p className="text-xs text-[var(--text-dim)] font-mono">
            {currentProfile ? formatDate(currentProfile.created_at) : '-'}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-xs py-2.5 px-6 flex items-center gap-2 shadow-sm cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Profili Güncelle</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

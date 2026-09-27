'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Eye, EyeOff, Loader2, Mail, Phone, Save, User } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { formatDate } from '@/lib/utils/format';
import { resolveAvatarUrl } from '@/lib/media/url';
import type { ContactVisibility } from '@/types';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

function VisibilityControl({ value, onChange, label }: { value: ContactVisibility; onChange: (value: ContactVisibility) => void; label: string }) {
  const isPublic = value === 'PUBLIC';
  return <button type="button" role="switch" aria-checked={isPublic} onClick={() => onChange(isPublic ? 'PRIVATE' : 'PUBLIC')} className="flex w-full items-center justify-between rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/45 px-3.5 py-3 text-left transition-colors hover:border-[#FF8A1F]/35"><span><span className="block text-xs font-semibold text-[var(--text-main)]">{label}</span><span className="mt-0.5 block text-[11px] text-[var(--text-dim)]">{isPublic ? 'İlan detaylarında gösterilir' : 'Public yanıtlarda gizlenir'}</span></span><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${isPublic ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--bg-app)] text-[var(--text-muted)]'}`}>{isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{isPublic ? 'Herkese Açık' : 'Gizli'}</span></button>;
}

export default function HesabimProfilPage() {
  const { currentProfile, updateCurrentProfile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(currentProfile?.avatar_path || currentProfile?.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [phone, setPhone] = useState(currentProfile?.phone || '');
  const [sanmailEmail, setSanmailEmail] = useState(currentProfile?.sanmail_email || '');
  const [phoneVisibility, setPhoneVisibility] = useState<ContactVisibility>(currentProfile?.phone_visibility || 'PUBLIC');
  const [sanmailVisibility, setSanmailVisibility] = useState<ContactVisibility>(currentProfile?.sanmail_visibility || 'PUBLIC');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentProfile) return;
    if (!avatarFile) setAvatarUrl(currentProfile.avatar_path || currentProfile.avatar_url || '');
    setPhone(currentProfile.phone || '');
    setSanmailEmail(currentProfile.sanmail_email || '');
    setPhoneVisibility(currentProfile.phone_visibility || 'PUBLIC');
    setSanmailVisibility(currentProfile.sanmail_visibility || 'PUBLIC');
  }, [currentProfile, avatarFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(''); const file = event.target.files?.[0]; if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) { setError('Profil fotoğrafı maksimum 2 MB olabilir.'); event.target.value = ''; return; }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) { setError('Yalnızca JPG, JPEG, PNG veya WEBP formatları desteklenmektedir.'); event.target.value = ''; return; }
    setAvatarFile(file); setAvatarImgError(false);
    const reader = new FileReader(); reader.onload = (e) => setAvatarUrl(String(e.target?.result || '')); reader.readAsDataURL(file);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault(); if (!currentProfile) return;
    setSubmitting(true); setError(''); setSuccess(false);
    let normalizedSanmail = sanmailEmail.trim(); if (normalizedSanmail && !normalizedSanmail.includes('@')) normalizedSanmail += '@sanmail.com';
    try {
      const response = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: avatarUrl, phone: phone.trim(), sanmail_email: normalizedSanmail, phone_visibility: phoneVisibility, sanmail_visibility: sanmailVisibility }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Profil güncellenemedi.');
      if (data.profile) updateCurrentProfile(data.profile);
      setAvatarFile(null); setSanmailEmail(normalizedSanmail); await refreshProfile(); setSuccess(true); setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) { setError(err.message || 'Bir hata oluştu.'); } finally { setSubmitting(false); }
  };

  const displayAvatar = avatarFile ? avatarUrl : resolveAvatarUrl(avatarUrl);
  return <div className="surface-card rounded-2xl border border-[var(--border-app)] p-6 sm:p-8"><header className="border-b border-[var(--border-app)] pb-5"><h2 className="text-xl font-bold text-[var(--text-main)]">Profilim</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Profil görselinizi, iletişim kanallarınızı ve ilan görünürlüğünü tek yerden yönetin.</p></header>
    {success && <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-[var(--color-success-subtle)] p-3.5 text-xs font-semibold text-[var(--color-success)]"><CheckCircle2 className="h-4 w-4" />Profil bilgileriniz güncellendi.</div>}
    {error && <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-[var(--color-danger-subtle)] p-3.5 text-xs font-semibold text-[var(--color-danger)]"><AlertCircle className="h-4 w-4" />{error}</div>}
    <form onSubmit={handleSave} className="mt-7 space-y-8">
      <section className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]"><div><h3 className="text-sm font-bold text-[var(--text-main)]">Kimlik</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Karakter adı GTA World profilinizden gelir.</p></div><div className="space-y-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><button type="button" onClick={() => fileInputRef.current?.click()} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-[#FF8A1F]/60 bg-[var(--brand-orange-subtle)]">{displayAvatar && !avatarImgError ? <img src={displayAvatar} alt="Profil" onError={() => setAvatarImgError(true)} className="h-full w-full object-cover" /> : <span className="text-2xl font-black text-[#FF8A1F]">{currentProfile?.full_name?.charAt(0) || 'U'}</span>}<span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"><Camera className="h-5 w-5 text-white" /></span></button><div><button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-xs"><Camera className="h-3.5 w-3.5 text-[#FF8A1F]" />Fotoğraf Seç</button><p className="mt-2 text-[11px] text-[var(--text-dim)]">JPG, PNG veya WEBP · maksimum 2 MB</p><input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleFileChange} className="hidden" /></div></div><div><label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]"><User className="h-3.5 w-3.5" />Karakter Adı</label><input value={currentProfile?.full_name || ''} disabled className="form-input cursor-not-allowed bg-[var(--bg-surface-secondary)] text-sm font-semibold opacity-80" /><p className="mt-1.5 text-[11px] text-[var(--text-dim)]">Kayıt: {currentProfile ? formatDate(currentProfile.created_at) : '-'}</p></div></div></section>
      <section className="grid gap-6 border-t border-[var(--border-app)] pt-8 md:grid-cols-[180px_minmax(0,1fr)]"><div><h3 className="text-sm font-bold text-[var(--text-main)]">İletişim</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Telefon ve SanMail görünürlüğünü bağımsız yönetin.</p></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-3"><label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]"><Phone className="h-3.5 w-3.5 text-[#FF8A1F]" />Telefon</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input text-sm" /><VisibilityControl label="Telefon görünürlüğü" value={phoneVisibility} onChange={setPhoneVisibility} /></div><div className="space-y-3"><label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]"><Mail className="h-3.5 w-3.5 text-[#FF8A1F]" />SanMail</label><input value={sanmailEmail} onChange={(e) => setSanmailEmail(e.target.value)} className="form-input text-sm" /><VisibilityControl label="SanMail görünürlüğü" value={sanmailVisibility} onChange={setSanmailVisibility} /></div></div></section>
      <div className="flex justify-end border-t border-[var(--border-app)] pt-6"><button type="submit" disabled={submitting} className="btn-primary inline-flex min-w-40 items-center justify-center gap-2 px-6 py-2.5 text-xs">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{submitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</button></div>
    </form></div>;
}
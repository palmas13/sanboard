'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CharacterProfile, DealerProfile } from '@/types';
import { Phone, Mail, Copy, Check, ShieldCheck, Building2, MapPin } from 'lucide-react';
import { resolveAvatarUrl, resolveMediaUrl } from '@/lib/media/url';
import { getCorporateUrl } from '@/lib/urls';

interface SellerCardProps {
  seller?: CharacterProfile;
  dealer?: DealerProfile;
  actions?: React.ReactNode;
}

export function SellerCard({ seller, dealer, actions }: SellerCardProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedMail, setCopiedMail] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!seller && !dealer) {
    return (
      <div className="surface-card p-6 rounded-2xl border border-[var(--border-app)] text-center text-xs text-[var(--text-muted)]">
        Satıcı bilgisi yüklenemedi.
      </div>
    );
  }

  // Source of truth: If dealer is linked to this listing, it is a corporate listing
  const isCorporate = Boolean(dealer);
  // Real data sources: No mock names or fake fallbacks
  const displayName = isCorporate
    ? dealer?.company_name || 'Kurumsal Mağaza'
    : seller?.full_name || 'İlan Sahibi';

  const displayAvatar = isCorporate
    ? resolveMediaUrl(dealer?.logo_path || dealer?.logo_url)
    : resolveAvatarUrl(seller?.avatar_path || seller?.avatar_url);

  const displayPhone = isCorporate
    ? dealer?.phone || ''
    : seller?.phone || '';

  const displayMail = isCorporate
    ? dealer?.sanmail_email || dealer?.email || ''
    : seller?.sanmail_email || '';

  const publicUrl = isCorporate
    ? getCorporateUrl(dealer!)
    : `/user/${seller?.public_id || seller?.id}`;

  const publicStoreUrl = isCorporate ? publicUrl : null;
  const displayLocation = isCorporate ? dealer?.address || '' : '';

  const handleCopyPhone = () => {
    if (!displayPhone) return;
    navigator.clipboard.writeText(displayPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyMail = () => {
    if (!displayMail) return;
    navigator.clipboard.writeText(displayMail);
    setCopiedMail(true);
    setTimeout(() => setCopiedMail(false), 2000);
  };

  return (
    <div data-testid={isCorporate ? 'corporate-seller-card' : 'individual-seller-card'} className={`surface-card rounded-2xl border p-3.5 shadow-[0_12px_36px_rgba(0,0,0,.12)] ${
      isCorporate ? 'border-[#FF8A1F]/20 bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-surface-secondary)]/70' : 'border-[var(--border-app)]'
    }`}>
      {/* Header Profile / Store Info */}
      <div className="flex items-center gap-3 border-b border-[var(--border-app)] pb-3">
        <Link href={publicUrl} className="shrink-0 group">
          {displayAvatar && !imgError ? (
            <img
              src={displayAvatar}
              alt={displayName}
              onError={() => setImgError(true)}
              className={`h-12 w-12 object-cover shadow-sm transition-colors ${
                isCorporate ? 'rounded-xl border border-[#FF8A1F]/35' : 'rounded-full border border-[var(--border-app)] group-hover:border-[#FF8A1F]'
              }`}
            />
          ) : (
            <div className={`flex h-12 w-12 items-center justify-center text-sm font-bold shadow-sm transition-colors ${
              isCorporate
                ? 'rounded-2xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border-2 border-[#FF8A1F]'
                : 'rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-main)] border border-[var(--border-app)] group-hover:border-[#FF8A1F]'
            }`}>
              {displayName.charAt(0)}
            </div>
          )}
        </Link>
        <div className="space-y-1 min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF9E45]">{isCorporate ? 'Kurumsal Profil' : 'İlan Sahibi'}</span>
          <Link href={publicUrl} className="block group">
            <h3 className="font-extrabold text-base text-[var(--text-main)] truncate group-hover:text-[#FF8A1F] transition-colors">
              {displayName}
            </h3>
          </Link>
          <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{isCorporate ? 'Doğrulanmış mağaza' : 'Doğrulanmış profil'}</span>
          </div>
        </div>
      </div>

      {/* Contact Details & Action CTAs */}
      <div className="mt-3 space-y-1.5">
        {/* Phone */}
        {displayPhone ? (
          <div className="flex items-center justify-between rounded-xl bg-[var(--bg-surface-secondary)]/65 px-3 py-2">
            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-[#FF8A1F] shrink-0" />
              <div>
                <p className="text-[10px] text-[var(--text-dim)]">
                  Telefon
                </p>
                <p className="text-xs font-bold text-[var(--text-main)] font-mono">{displayPhone}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyPhone}
              className="cursor-pointer rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--bg-surface-hover)] hover:text-[#FF8A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]/50"
              title="Telefonu Kopyala"
            >
              {copiedPhone ? <Check className="w-4 h-4 text-[var(--color-success)]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        ) : null}

        {/* SanMail */}
        {displayMail ? (
          <div className="flex items-center justify-between rounded-xl bg-[var(--bg-surface-secondary)]/65 px-3 py-2">
            <div className="flex items-center gap-2.5 truncate mr-2">
              <Mail className="w-4 h-4 text-[#FF8A1F] shrink-0" />
              <div className="truncate">
                <p className="text-[10px] text-[var(--text-dim)]">
                  SanMail
                </p>
                <p className="text-xs font-bold text-[var(--text-main)] truncate">{displayMail}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyMail}
              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--bg-surface-hover)] hover:text-[#FF8A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]/50"
              title="Mail Adresini Kopyala"
            >
              {copiedMail ? <Check className="w-4 h-4 text-[var(--color-success)]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        ) : null}

        {displayLocation ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-[var(--bg-surface-secondary)]/65 px-3 py-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A1F]" />
            <div className="min-w-0"><p className="text-[10px] text-[var(--text-dim)]">Konum</p><p className="mt-0.5 text-xs font-bold leading-5 text-[var(--text-main)]">{displayLocation}</p></div>
          </div>
        ) : null}

        {/* Corporate store CTA */}
        {isCorporate && publicStoreUrl && (
          <Link
            href={publicStoreUrl}
            className="btn-secondary mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-xs"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Mağazaya Git</span>
          </Link>
        )}
        {actions ? <div className="mt-2 grid gap-2 border-t border-[var(--border-app)] pt-3">{actions}</div> : null}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CharacterProfile, DealerProfile } from '@/types';
import { Phone, Mail, Copy, Check, ExternalLink, ShieldCheck, Crown, Building2 } from 'lucide-react';

interface SellerCardProps {
  seller?: CharacterProfile;
  dealer?: DealerProfile;
}

export function SellerCard({ seller, dealer }: SellerCardProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedMail, setCopiedMail] = useState(false);

  if (!seller && !dealer) {
    return (
      <div className="surface-card p-6 rounded-2xl border border-[var(--border-app)] text-center text-xs text-[var(--text-muted)]">
        Satıcı bilgisi yüklenemedi.
      </div>
    );
  }

  const isCorporate = Boolean(dealer || seller?.is_dealer);
  const sanmailBaseUrl = process.env.NEXT_PUBLIC_SANMAIL_BASE_URL;

  // Corporate values take precedence if corporate seller
  const displayName = isCorporate
    ? dealer?.company_name || 'Blackline Motors'
    : seller?.full_name || 'İlan Sahibi';

  const displayAvatar = isCorporate
    ? dealer?.logo_url || 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300'
    : seller?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';

  const displayPhone = isCorporate
    ? dealer?.phone || seller?.phone || '555-0192'
    : seller?.phone || '555-0192';

  const displayMail = isCorporate
    ? dealer?.sanmail_email || dealer?.email || seller?.sanmail_email || 'kurumsal@sanmail.com'
    : seller?.sanmail_email || 'satici@sanmail.com';

  const storeId = dealer?.id || seller?.dealer_id || 'dealer-apex-01';

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(displayPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyMail = () => {
    navigator.clipboard.writeText(displayMail);
    setCopiedMail(true);
    setTimeout(() => setCopiedMail(false), 2000);
  };

  return (
    <div className={`surface-card p-6 rounded-2xl border space-y-5 shadow-sm ${
      isCorporate ? 'border-[#FF8A1F]/30 bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-surface-secondary)]' : 'border-[var(--border-app)]'
    }`}>
      {/* Header Profile / Store Info */}
      <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--border-app)]">
        <img
          src={displayAvatar}
          alt={displayName}
          className={`w-14 h-14 rounded-2xl object-cover border-2 shadow-sm shrink-0 ${
            isCorporate ? 'border-[#FF8A1F] ring-2 ring-[#FF8A1F]/20' : 'border-[var(--border-app)] rounded-full'
          }`}
        />
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
              {isCorporate ? 'Kurumsal Satıcı' : 'İlan Sahibi'}
            </span>
            {isCorporate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] border border-[#FF8A1F]/30 text-[10px] font-black">
                <Crown className="w-3 h-3 fill-current" />
                <span>Premium Satıcı</span>
              </span>
            )}
          </div>
          <h3 className="font-extrabold text-base text-[var(--text-main)] truncate">
            {displayName}
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-[var(--color-success)] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{isCorporate ? 'Onaylı Kurumsal Galeri' : 'Onaylı Karakter'}</span>
          </div>
        </div>
      </div>

      {/* Contact Details & Action CTAs */}
      <div className="space-y-2.5">
        {/* Phone */}
        <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-[#FF8A1F] shrink-0" />
            <div>
              <p className="text-[10px] text-[var(--text-dim)]">
                {isCorporate ? 'Kurumsal Telefon' : 'Telefon'}
              </p>
              <p className="text-xs font-bold text-[var(--text-main)] font-mono">{displayPhone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyPhone}
            className="p-1.5 rounded-lg border border-[var(--border-app)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[#FF8A1F] transition-colors cursor-pointer"
            title="Telefonu Kopyala"
          >
            {copiedPhone ? <Check className="w-4 h-4 text-[var(--color-success)]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* SanMail */}
        <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate mr-2">
            <Mail className="w-4 h-4 text-[#FF8A1F] shrink-0" />
            <div className="truncate">
              <p className="text-[10px] text-[var(--text-dim)]">
                {isCorporate ? 'Kurumsal SanMail' : 'SanMail'}
              </p>
              <p className="text-xs font-bold text-[var(--text-main)] truncate">{displayMail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyMail}
            className="p-1.5 rounded-lg border border-[var(--border-app)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[#FF8A1F] transition-colors cursor-pointer shrink-0"
            title="Mail Adresini Kopyala"
          >
            {copiedMail ? <Check className="w-4 h-4 text-[var(--color-success)]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* SanMail CTA Button */}
        {sanmailBaseUrl ? (
          <a
            href={sanmailBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full btn-secondary text-xs py-2.5 flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>SanMail'i Aç</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={handleCopyMail}
            className="w-full btn-secondary text-xs py-2.5 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-[#FF8A1F]" />
            <span>{copiedMail ? 'SanMail Kopyalandı!' : 'SanMail ile İletişime Geç'}</span>
          </button>
        )}

        {/* Corporate Only: [ Mağazayı Görüntüle ] CTA Button */}
        {isCorporate && (
          <Link
            href={`/magaza/${storeId}`}
            className="w-full btn-primary text-xs py-2.5 flex items-center justify-center gap-1.5 shadow-sm mt-1"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Mağazayı Görüntüle</span>
          </Link>
        )}
      </div>
    </div>
  );
}

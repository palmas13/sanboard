import React from 'react';
import { Mail, MapPin, Building } from 'lucide-react';
import { SanboardLogo } from '@/components/common/SanboardLogo';

export default function IletisimPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
      <SanboardLogo size="md" />
      <h1 className="text-2xl font-black text-[var(--text-main)]">
        İletişim
      </h1>

      <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6 text-sm text-[var(--text-main)]">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Sanboard kurumsal işbirlikleri, reklam talepleri ve teknik destek için Los Santos merkez ofisimiz ve SanMail kanallarımız üzerinden iletişime geçebilirsiniz.
        </p>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-[#FF8A1F]" />
            <div>
              <p className="text-xs text-[var(--text-dim)]">Resmi SanMail</p>
              <p className="font-semibold text-[var(--text-main)]">destek@sanmail.com</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Building className="w-5 h-5 text-[#FF8A1F]" />
            <div>
              <p className="text-xs text-[var(--text-dim)]">Merkez Ofis</p>
              <p className="font-semibold text-[var(--text-main)]">Pillbox Hill, San Andreas Ave No: 42</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#FF8A1F]" />
            <div>
              <p className="text-xs text-[var(--text-dim)]">Bölge</p>
              <p className="font-semibold text-[var(--text-main)]">Downtown Los Santos, San Andreas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

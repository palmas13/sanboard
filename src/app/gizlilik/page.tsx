import React from 'react';
import { SanboardLogo } from '@/components/common/SanboardLogo';

export default function GizlilikPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
      <SanboardLogo size="md" />
      <h1 className="text-2xl font-black text-[var(--text-main)]">
        Gizlilik Politikası
      </h1>
      <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-4 text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
        <p>
          Sanboard, kullanıcıların gizliliğine ve rol içi verilerin güvenliğine saygı duyar.
        </p>
        <p>
          İlanlarda yer alan telefon ve SanMail bilgileri yalnızca oturum açmış Sanboard üyelerine gösterilir. Üye olmayan ziyaretçilere ve arama motorlarına bu veriler sunucu seviyesinde maskelenir.
        </p>
        <p>
          Platformda hiçbir gerçek banka bilgisi, kredi kartı veya şifre tutulmaz. Fleeca ödemeleri roleplay çerçevesinde oyun içi bankacılık protokolü aracılığıyla işlenir.
        </p>
      </div>
    </div>
  );
}

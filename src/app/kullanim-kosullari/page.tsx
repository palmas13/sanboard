import React from 'react';
import { SanboardLogo } from '@/components/common/SanboardLogo';

export default function KullanimKosullariPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
      <SanboardLogo size="md" />
      <h1 className="text-2xl font-black text-[var(--text-main)]">
        Kullanım Koşulları
      </h1>
      <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-4 text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
        <p>
          1. Sanboard, GTA World platformunda yer alan oyuncular için bir rol içi ilan servisidir. Platformdaki para birimi GTA World oyun içi dolarıdır ($).
        </p>
        <p>
          2. İlan başlığı en fazla 60 karakter, açıklama ise en fazla 100 karakter olabilir. Gerçeğe aykırı, oyun kurallarını ihlal eden veya troll içerikli ilanlar admin ekibi tarafından uyarılmaksızın yayından kaldırılabilir.
        </p>
        <p>
          3. İlan paketleri 7 gün geçerlidir. 7 gün sonunda ilan public aramalardan otomatik olarak çıkarılır. İlan süresi boyunca düzenleme ücretsizdir.
        </p>
        <p>
          4. Satıldı olarak işaretlenen ilanlar kalıcı olarak silinir ve geri getirilemez.
        </p>
      </div>
    </div>
  );
}

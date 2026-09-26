import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { SanboardLogo } from '@/components/common/SanboardLogo';
import { isTestLoginEnabled } from '@/lib/auth/test-login';
import { MOCK_CHARACTERS } from '@/lib/integrations/gtaworld/mock-provider';

export const dynamic = 'force-dynamic';

export default async function TestGirisPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  if (!isTestLoginEnabled()) notFound();
  const { redirect = '/' } = await searchParams;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full surface-card p-6 sm:p-8 rounded-2xl border border-amber-500/25 shadow-2xl space-y-6">
        <div className="flex justify-center"><SanboardLogo size="md" /></div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-amber-500"><AlertTriangle className="w-4 h-4" />TEST KARAKTERLERİ</div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">Bu ekrandaki karakterler gerçek GTA World hesapları değildir. Yalnızca Sanboard'un özelliklerini test etmek amacıyla oluşturulmuştur. Bu hesaplar ve tüm test verileri daha sonra silinebilir.</p>
        </div>
        <div className="space-y-2">
          {MOCK_CHARACTERS.map((character) => (
            <div key={character.id} className="flex items-center justify-between rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] px-4 py-3">
              <span className="text-sm font-bold text-[var(--text-main)]">{character.fullName}</span>
              <span className="rounded border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">TEST</span>
            </div>
          ))}
        </div>
        <Link href={`/api/auth/test-login?redirect=${encodeURIComponent(redirect)}`} className="btn-secondary w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
          Karakter seçimine devam et <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-center text-[11px] text-[var(--text-dim)]">Devam ettiğinde test kaynağı canonical Sanboard hesap/profil sync akışından geçirilir.</p>
      </div>
    </div>
  );
}
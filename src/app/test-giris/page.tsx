import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { SanboardLogo } from '@/components/common/SanboardLogo';
import { isTestLoginEnabled } from '@/lib/auth/test-login';
import { TEST_LOGIN_ACCOUNTS } from '@/lib/integrations/gtaworld/mock-provider';
import { normalizeInternalRedirect } from '@/lib/auth/redirect';

export const dynamic = 'force-dynamic';

export default async function TestGirisPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  if (!isTestLoginEnabled()) notFound();
  const params = await searchParams;
  const redirect = normalizeInternalRedirect(params.redirect);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full surface-card p-6 sm:p-8 rounded-2xl border border-amber-500/25 shadow-2xl space-y-6">
        <div className="flex justify-center"><SanboardLogo size="md" /></div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-amber-500"><AlertTriangle className="w-4 h-4" />TEST KARAKTERLERİ</div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">Bu ekrandaki karakterler gerçek GTA World hesapları değildir. Yalnızca Sanboard'un özelliklerini test etmek amacıyla oluşturulmuştur. Bu hesaplar ve tüm test verileri daha sonra silinebilir.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.values(TEST_LOGIN_ACCOUNTS).map((account) => (
            <section key={account.key} className="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-4 space-y-3">
              <div>
                <h2 className="font-extrabold text-[var(--text-main)]">{account.label}</h2>
                <p className="text-xs text-[var(--text-muted)]">{account.characters.length} test karakteri</p>
              </div>
              <div className="space-y-2">
                {account.characters.map((character, index) => (
                  <div key={character.id} className="flex items-center justify-between rounded-lg border border-[var(--border-app)] px-3 py-2">
                    <span className="text-sm font-bold text-[var(--text-main)]">{character.fullName}</span>
                    {account.key === 'secondary' && index === 0 ? (
                      <span className="text-[10px] font-bold text-[var(--color-success)]">VARSAYILAN</span>
                    ) : null}
                  </div>
                ))}
              </div>
              <Link href={`/api/auth/test-login?account=${account.key}&redirect=${encodeURIComponent(redirect)}`} className="btn-secondary w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
                {account.label} ile devam et <ArrowRight className="w-4 h-4" />
              </Link>
            </section>
          ))}
        </div>
        <p className="text-center text-[11px] text-[var(--text-dim)]">Devam ettiğinde test kaynağı canonical Sanboard hesap/profil sync akışından geçirilir.</p>
      </div>
    </div>
  );
}
'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SanboardLogo } from '@/components/common/SanboardLogo';
import { ShieldCheck, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';

function GirisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { login } = useAuth();

  const handleMockLogin = () => {
    login();
    router.push(`/karakter-sec?redirect=${encodeURIComponent(redirect)}`);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full surface-card p-8 rounded-2xl border border-[var(--border-app)] shadow-2xl space-y-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-center">
          <SanboardLogo size="lg" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
            Sanboard'a hoş geldin
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            GTA World hesabınla giriş yaparak ilan detaylarını inceleyebilir ve kendi araç ya da mülk ilanlarını oluşturabilirsin.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)]/70 border border-[var(--border-app)] text-left space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF8A1F]">
            <ShieldCheck className="w-4 h-4" />
            <span>GTA World Giriş Sistemi</span>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Sanboard hiçbir zaman oyun içi şifrenizi veya hesap bilgilerinizi talep etmez.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMockLogin}
          className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          <LogIn className="w-4 h-4" />
          <span>GTA World ile Giriş Yap</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function GirisPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Yükleniyor...</div>}>
      <GirisContent />
    </Suspense>
  );
}

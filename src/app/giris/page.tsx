'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SanboardLogo } from '@/components/common/SanboardLogo';
import { ShieldCheck, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

function GirisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const errorCode = searchParams.get('error');

  const handleLogin = () => {
    // Redirect through the server-side OAuth initiator route
    window.location.href = `/api/auth/gtaworld/login?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full surface-card p-8 rounded-2xl border border-[var(--border-app)] shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-center">
          <SanboardLogo size="lg" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
            Sanboard'a hoş geldin
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            GTA World UCP hesabınla giriş yaparak ilan detaylarını inceleyebilir ve kendi araç ya da mülk ilanlarını oluşturabilirsin.
          </p>
        </div>

        {/* Controlled OAuth Error Banner */}
        {errorCode && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-left space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Giriş Yapılamadı</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              GTA World ile giriş yapılamadı. Lütfen tekrar deneyin.
            </p>
            <button
              type="button"
              onClick={handleLogin}
              className="mt-1 text-xs font-bold text-[#FF8A1F] hover:underline flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tekrar dene</span>
            </button>
          </div>
        )}

        <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)]/70 border border-[var(--border-app)] text-left space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF8A1F]">
            <ShieldCheck className="w-4 h-4" />
            <span>GTA World Güvenli Giriş</span>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Sanboard üçüncü taraf bağımsız bir ilan platformudur ve oyun içi şifrenizi asla talep etmez.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg hover:shadow-orange-500/10 cursor-pointer"
        >
          <img
            src="/brands/gta-world.png"
            alt="GTA World"
            className="h-5 w-auto object-contain shrink-0"
          />
          <span>GTA World ile Giriş Yap</span>
          <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
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

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { PlusCircle, Loader2 } from 'lucide-react';

export default function IlanVerRouterPage() {
  const router = useRouter();
  const { currentProfile, isAuthenticated, isLoading } = useAuth();
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !currentProfile) {
      router.push('/giris?redirect=/ilan-ver');
      return;
    }

    // Identity and entitlement selection always happens on the account-aware
    // package route. A total credit count cannot safely choose PERSONAL.
    router.replace('/ilan-ver/paket');
  }, [currentProfile, isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F] flex items-center justify-center">
        <PlusCircle className="w-6 h-6 animate-pulse" />
      </div>
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] font-medium">
        <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
        <span>İlan hakkı kontrol ediliyor...</span>
      </div>
    </div>
  );
}

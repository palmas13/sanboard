'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { PlusCircle, Loader2 } from 'lucide-react';

export default function IlanVerRouterPage() {
  const router = useRouter();
  const { currentProfile, isAuthenticated, isLoading } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !currentProfile) {
      router.push('/giris?redirect=/ilan-ver');
      return;
    }

    // Check available credits
    async function checkCredits() {
      try {
        const res = await fetch('/api/credits');
        const data = await res.json();

        if (data.testPublishBypass === true || data.availableCredits > 0) {
          router.replace('/ilan-ver/yeni');
        } else {
          router.replace('/ilan-ver/paket');
        }
      } catch {
        router.replace('/ilan-ver/paket');
      } finally {
        setChecking(false);
      }
    }

    checkCredits();
  }, [currentProfile, isAuthenticated, router]);

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

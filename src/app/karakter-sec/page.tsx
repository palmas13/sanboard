'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { ChevronRight, UserPlus, CheckCircle2, Loader2 } from 'lucide-react';
import { SanboardLogo } from '@/components/common/SanboardLogo';
import { resolveAvatarUrl } from '@/lib/media/url';

function KarakterSecContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { characters, characterProfiles, selectCharacter, currentProfile } = useAuth();
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  const handleSelect = async (characterId: string, hasProfile: boolean) => {
    if (switchingId) return;

    if (hasProfile) {
      setSwitchingId(characterId);
      try {
        const res = await selectCharacter(characterId);
        if (res) {
          router.push(redirect);
        } else {
          setSwitchingId(null);
        }
      } catch {
        setSwitchingId(null);
      }
    } else {
      router.push(`/profil-olustur?charId=${characterId}&redirect=${encodeURIComponent(redirect)}`);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] shadow-2xl space-y-6 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <SanboardLogo size="md" />
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
            Karakterini seç
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Sanboard'u kullanmak istediğin karakteri seç.
          </p>
        </div>

        {/* Character Rows */}
        <div className="space-y-3 pt-2">
          {characters.map((char) => {
            const initials = char.fullName
              .split(' ')
              .map((n) => n[0])
              .join('');

            // Resolve avatar strictly from real Supabase profile (NO mock/static avatar flash)
            const profile = characterProfiles[char.id] || (currentProfile?.id === char.id ? currentProfile : null);
            const avatarPath = profile?.avatar_path || profile?.avatar_url;
            const charAvatar = avatarPath ? resolveAvatarUrl(avatarPath) : null;
            const isSwitching = switchingId === char.id;

            return (
              <button
                key={char.id}
                type="button"
                disabled={Boolean(switchingId)}
                onClick={() => handleSelect(char.id, char.hasProfile)}
                className={`w-full surface-card surface-card-hover p-4 rounded-xl flex items-center justify-between gap-4 text-left transition-all border ${
                  isSwitching
                    ? 'border-[#FF8A1F] bg-[var(--brand-orange-subtle)]/20 cursor-wait'
                    : 'border-[var(--border-app)] hover:border-[#FF8A1F] cursor-pointer'
                } group`}
              >
                <div className="flex items-center gap-3.5">
                  {charAvatar ? (
                    <img
                      src={charAvatar}
                      alt={char.fullName}
                      className="w-12 h-12 rounded-full object-cover border border-[var(--border-app)] group-hover:border-[#FF8A1F] transition-colors"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] font-bold flex items-center justify-center text-sm border border-[rgba(255,138,31,0.3)]">
                      {initials}
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-base text-[var(--text-main)] group-hover:text-[#FF8A1F] transition-colors">
                      {char.fullName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {char.hasProfile ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Profil mevcut</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#FF8A1F] font-medium">
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Profil oluşturulacak</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isSwitching ? (
                  <Loader2 className="w-5 h-5 text-[#FF8A1F] animate-spin" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-[var(--text-dim)] group-hover:text-[#FF8A1F] group-hover:translate-x-1 transition-all" />
                )}
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-[var(--text-dim)] pt-2 border-t border-[var(--border-app)]">
          Bir GTA World hesabı birden fazla karaktere sahip olabilir. Her karakterin Sanboard profili bağımsızdır.
        </p>
      </div>
    </div>
  );
}

export default function KarakterSecPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Yükleniyor...</div>}>
      <KarakterSecContent />
    </Suspense>
  );
}

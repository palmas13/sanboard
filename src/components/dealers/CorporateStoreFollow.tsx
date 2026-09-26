'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import { Users, UserPlus, UserCheck, X, Loader2, ExternalLink } from 'lucide-react';
import { resolveAvatarUrl } from '@/lib/media/url';

interface FollowerItem {
  id: string;
  name: string;
  avatar_path?: string;
  avatar_url?: string;
  public_id?: number;
}

interface CorporateStoreFollowProps {
  dealerId: string;
  initialFollowerCount?: number;
  initialIsFollowing?: boolean | null;
}

type FollowState = 'loading' | 'following' | 'not_following';

export function CorporateStoreFollow({
  dealerId,
  initialFollowerCount = 0,
  initialIsFollowing = null,
}: CorporateStoreFollowProps) {
  const { currentProfile, isAuthenticated, authStatus } = useAuth();
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [followState, setFollowState] = useState<FollowState>(
    initialIsFollowing === true
      ? 'following'
      : initialIsFollowing === false
      ? 'not_following'
      : 'loading'
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [followers, setFollowers] = useState<FollowerItem[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);

  // Check follow status on mount & character switch (Sections 15-17)
  useEffect(() => {
    // If auth state is still resolving, hold loading state
    if (authStatus === 'loading') {
      setFollowState('loading');
      return;
    }

    // If conclusively unauthenticated, state is not_following
    if (!isAuthenticated || !currentProfile?.id) {
      setFollowState('not_following');
      return;
    }

    let isCancelled = false;
    setFollowState('loading');

    async function checkStatus() {
      try {
        const res = await fetch(`/api/dealers/${dealerId}/follow`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setFollowState(data.isFollowing ? 'following' : 'not_following');
            setFollowerCount(data.followerCount ?? data.count ?? 0);
          }
        } else {
          if (!isCancelled) setFollowState('not_following');
        }
      } catch {
        if (!isCancelled) setFollowState('not_following');
      }
    }

    checkStatus();
    return () => {
      isCancelled = true;
    };
  }, [dealerId, currentProfile?.id, isAuthenticated, authStatus]);

  const handleToggleFollow = async () => {
    if (!isAuthenticated || !currentProfile) {
      alert('Mağazayı takip etmek için lütfen giriş yapınız.');
      return;
    }

    if (actionLoading) return;
    const desiredIsFollowing = followState !== 'following';
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dealers/${dealerId}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFollowing: desiredIsFollowing }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Takip işlemi gerçekleştirilemedi.');
      setFollowState(data.isFollowing ? 'following' : 'not_following');
      setFollowerCount(data.followerCount ?? data.count ?? followerCount);
    } catch {
      // Ignore
    } finally {
      setActionLoading(false);
    }
  };

  const openFollowersModal = async () => {
    setModalOpen(true);
    setLoadingFollowers(true);
    try {
      const res = await fetch(`/api/dealers/${dealerId}/followers`);
      if (res.ok) {
        const data = await res.json();
        setFollowers(data.followers || []);
      }
    } catch {
      setFollowers([]);
    } finally {
      setLoadingFollowers(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5">
        {/* Followers Count Badge (clickable to view list) */}
        <button
          type="button"
          onClick={openFollowersModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface-secondary)] hover:bg-[var(--border-app)] text-xs font-semibold text-[var(--text-main)] border border-[var(--border-app)] transition-colors cursor-pointer"
          title="Takipçileri Görüntüle"
        >
          <Users className="w-3.5 h-3.5 text-[#FF8A1F]" />
          <span>{followerCount} Takipçi</span>
        </button>

        {/* Follow / Unfollow Button with Stable Loading State (Sections 15-16: No 0.5s flicker) */}
        {followState === 'loading' ? (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--bg-surface-secondary)] text-[var(--text-dim)] border border-[var(--border-app)] opacity-80 cursor-wait shadow-sm"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF8A1F]" />
            <span>Yükleniyor...</span>
          </button>
        ) : followState === 'following' ? (
          <button
            type="button"
            onClick={handleToggleFollow}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Takip Ediliyor</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleFollow}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer btn-primary"
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Takip Et</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Followers List Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="surface-card w-full max-w-md rounded-2xl border border-[var(--border-app)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--border-app)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FF8A1F]" />
                <h3 className="font-bold text-sm sm:text-base text-[var(--text-main)]">
                  Takipçiler ({followerCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {loadingFollowers ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF8A1F]" />
                  <span>Takipçiler yükleniyor...</span>
                </div>
              ) : followers.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                  Bu mağazanın henüz takipçisi bulunmuyor.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-app)]">
                  {followers.map((f) => {
                    const avatarSrc = resolveAvatarUrl(f.avatar_path || f.avatar_url);
                    return (
                      <div
                        key={f.id}
                        className="py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-surface-secondary)]/40 px-2 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] overflow-hidden shrink-0 flex items-center justify-center">
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={f.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-[#FF8A1F]">{f.name?.[0] || 'U'}</span>
                            )}
                          </div>
                          {/* Sections 35 & 39: Show Avatar, Character name, Profili Gör. NO #public_id under name! */}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text-main)] truncate">{f.name}</p>
                          </div>
                        </div>

                        <Link
                          href={`/user/${f.public_id || f.id}`}
                          className="btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1 shrink-0"
                        >
                          <span>Profili Gör</span>
                          <ExternalLink className="w-3 h-3 text-[var(--text-dim)]" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

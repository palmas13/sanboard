'use client';

import React, { useState } from 'react';
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
  initialIsFollowing?: boolean;
}

export function CorporateStoreFollow({
  dealerId,
  initialFollowerCount = 0,
  initialIsFollowing = false,
}: CorporateStoreFollowProps) {
  const { currentProfile, isAuthenticated } = useAuth();
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [followers, setFollowers] = useState<FollowerItem[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);

  // Check follow status on mount if profile exists
  React.useEffect(() => {
    if (!currentProfile) return;
    let isCancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/dealers/${dealerId}/follow?profileId=${currentProfile?.id}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setIsFollowing(data.isFollowing);
            setFollowerCount(data.followerCount);
          }
        }
      } catch {
        // Ignore background fetch error
      }
    }

    checkStatus();
    return () => {
      isCancelled = true;
    };
  }, [dealerId, currentProfile]);

  const handleToggleFollow = async () => {
    if (!isAuthenticated || !currentProfile) {
      alert('Mağazayı takip etmek için lütfen giriş yapınız.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/dealers/${dealerId}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerProfileId: currentProfile.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.isFollowing);
        setFollowerCount(data.followerCount);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
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

        {/* Follow / Unfollow Button */}
        <button
          type="button"
          onClick={handleToggleFollow}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
            isFollowing
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
              : 'btn-primary'
          }`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isFollowing ? (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              <span>Takip Ediliyor</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Takip Et</span>
            </>
          )}
        </button>
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
                className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-secondary)]"
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
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text-main)] truncate">{f.name}</p>
                            {f.public_id && (
                              <span className="text-[10px] font-mono text-[var(--text-dim)]">
                                #{f.public_id}
                              </span>
                            )}
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

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CharacterProfile, User } from '@/types';
import { MOCK_CHARACTERS } from '@/lib/integrations/gtaworld/mock-provider';
import { resolveMediaUrl } from '@/lib/media/url';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  currentProfile: CharacterProfile | null;
  characters: typeof MOCK_CHARACTERS;
  characterProfiles: Record<string, CharacterProfile>;
  authStatus: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  selectCharacter: (characterId: string) => Promise<CharacterProfile | null>;
  updateCurrentProfile: (data: Partial<CharacterProfile>) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_CHARACTER_ACCOUNTS: Record<string, User> = {
  '44444444-4444-4444-4444-444444444441': {
    id: '22222222-2222-2222-2222-222222222222',
    provider: 'GTAWORLD',
    role: 'ADMIN',
    status: 'ACTIVE',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  '44444444-4444-4444-4444-444444444442': {
    id: '33333333-3333-3333-3333-333333333333',
    provider: 'GTAWORLD',
    role: 'USER',
    status: 'ACTIVE',
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
  },
  'char-mavis-01': {
    id: '22222222-2222-2222-2222-222222222222',
    provider: 'GTAWORLD',
    role: 'ADMIN',
    status: 'ACTIVE',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  'char-zade-02': {
    id: '33333333-3333-3333-3333-333333333333',
    provider: 'GTAWORLD',
    role: 'USER',
    status: 'ACTIVE',
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<CharacterProfile | null>(null);
  const [characterProfiles, setCharacterProfiles] = useState<Record<string, CharacterProfile>>({});
  const [characters] = useState(MOCK_CHARACTERS);

  const saveState = useCallback(
    (newUser: User | null, newProfile: CharacterProfile | null) => {
      // Keep state strictly in React memory — NO localStorage for profile/user data
      setUser(newUser);
      setCurrentProfile(newProfile);

      if (newUser && newProfile) {
        setAuthStatus('authenticated');
        setCharacterProfiles((prev) => ({
          ...prev,
          [newProfile.id]: newProfile,
        }));

        // Synchronize cryptographically signed server session
        fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: newProfile.id,
            profileId: newProfile.id,
            userId: newUser.id,
            role: newUser.role,
          }),
        }).catch(() => {});

        // Lightweight routing cookies (for middleware & SSR redirects)
        document.cookie = `sanboard_profile_id=${newProfile.id}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `sanboard_user_id=${newUser.id}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `sanboard_role=${newUser.role}; path=/; max-age=86400; SameSite=Lax`;
      } else {
        setAuthStatus('unauthenticated');
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        document.cookie = `sanboard_profile_id=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `sanboard_user_id=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `sanboard_role=; path=/; max-age=0; SameSite=Lax`;
      }
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!currentProfile?.id) return;
    try {
      const res = await fetch(`/api/user/profile?profileId=${currentProfile.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.profile) {
          saveState(user, data.profile);
        }
      }
    } catch {
      // Ignore network errors on background refresh
    }
  }, [currentProfile, user, saveState]);

  // Load known character profiles from Supabase in the background for character chooser
  const loadCharacterProfiles = useCallback(async () => {
    const profileMap: Record<string, CharacterProfile> = {};
    for (const char of characters) {
      if (char.hasProfile) {
        try {
          const res = await fetch(`/api/user/profile?profileId=${char.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data.profile) {
              profileMap[char.id] = data.profile;
            }
          }
        } catch {
          // Ignore
        }
      }
    }
    if (Object.keys(profileMap).length > 0) {
      setCharacterProfiles((prev) => ({ ...prev, ...profileMap }));
    }
  }, [characters]);

  useEffect(() => {
    // Purge legacy localStorage auth cache if present
    try {
      localStorage.removeItem('sanboard-auth-state');
      localStorage.removeItem('sanboard_profile');
      localStorage.removeItem('sanboard_user');
      localStorage.removeItem('currentProfile');
      localStorage.removeItem('avatar');
    } catch {
      // Ignore
    }

    // Hydrate current session directly from Supabase /api/user/profile
    fetch('/api/user/profile')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data.profile) {
            const profile = data.profile as CharacterProfile;
            const linkedUser: User =
              MOCK_CHARACTER_ACCOUNTS[profile.id] ||
              MOCK_CHARACTER_ACCOUNTS[profile.user_id] || {
                id: profile.user_id || `usr-${profile.id}`,
                provider: 'GTAWORLD',
                role: 'USER',
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            setUser(linkedUser);
            setCurrentProfile(profile);
            setCharacterProfiles((prev) => ({ ...prev, [profile.id]: profile }));
            setAuthStatus('authenticated');
            return;
          }
        }
        setAuthStatus('unauthenticated');
      })
      .catch(() => {
        setAuthStatus('unauthenticated');
      })
      .finally(() => {
        loadCharacterProfiles().catch(() => {});
      });
  }, [loadCharacterProfiles]);

  const selectCharacter = async (characterId: string): Promise<CharacterProfile | null> => {
    const char = characters.find((c) => c.id === characterId);
    if (!char) return null;

    setAuthStatus('loading');

    try {
      // 1. Establish server-side signed HMAC session first and await confirmation
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, profileId: characterId }),
      });

      if (!sessionRes.ok) {
        setAuthStatus('unauthenticated');
        return null;
      }

      const sessionData = await sessionRes.json();
      const userId = sessionData.user?.id || (characterId.startsWith('usr-') ? characterId : `usr-${characterId}`);
      const role = (sessionData.user?.role || 'USER') as 'USER' | 'ADMIN';

      const linkedUser: User = {
        id: userId,
        provider: 'GTAWORLD',
        role,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 2. Hydrate authoritative profile from Supabase
      const profRes = await fetch(`/api/user/profile?profileId=${characterId}`);
      let profile: CharacterProfile | null = null;
      if (profRes.ok) {
        const profData = await profRes.json();
        if (profData?.success && profData.profile) {
          profile = profData.profile;
        }
      }

      if (!profile) {
        profile = {
          id: char.id,
          user_id: linkedUser.id,
          external_character_id: char.id,
          full_name: char.fullName,
          avatar_path: '',
          avatar_url: '',
          sanmail_email:
            char.sanmailEmail || `${char.fullName.toLowerCase().replace(' ', '.')}@sanmail.com`,
          phone: char.phone || '555-0100',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      setUser(linkedUser);
      setCurrentProfile(profile);
      setCharacterProfiles((prev) => ({ ...prev, [profile.id]: profile }));
      setAuthStatus('authenticated');

      // Set client routing cookies
      document.cookie = `sanboard_profile_id=${profile.id}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `sanboard_user_id=${linkedUser.id}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `sanboard_role=${linkedUser.role}; path=/; max-age=86400; SameSite=Lax`;

      return profile;
    } catch (err) {
      console.error('Character switch error:', err);
      setAuthStatus('unauthenticated');
      return null;
    }
  };

  const login = async () => {
    await selectCharacter('44444444-4444-4444-4444-444444444441');
  };

  const logout = async () => {
    saveState(null, null);
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    window.location.href = '/';
  };

  const updateCurrentProfile = (data: Partial<CharacterProfile>) => {
    if (!currentProfile) return;
    const updated = {
      ...currentProfile,
      ...data,
      updated_at: new Date().toISOString(),
    };
    if (updated.avatar_path && !updated.avatar_url) {
      updated.avatar_url = resolveMediaUrl(updated.avatar_path);
    }
    saveState(user, updated);
  };

  const isAuthenticated = authStatus === 'authenticated' && Boolean(user && currentProfile);
  const isLoading = authStatus === 'loading';

  return (
    <AuthContext.Provider
      value={{
        user,
        currentProfile,
        characters,
        characterProfiles,
        authStatus,
        isLoading,
        isAuthenticated,
        isAdmin: user?.role === 'ADMIN',
        login,
        logout,
        selectCharacter,
        updateCurrentProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

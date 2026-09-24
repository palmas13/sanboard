'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CharacterProfile, User } from '@/types';
import { MOCK_CHARACTERS } from '@/lib/integrations/gtaworld/mock-provider';
import { resolveMediaUrl } from '@/lib/media/url';

interface AuthContextType {
  user: User | null;
  currentProfile: CharacterProfile | null;
  characters: typeof MOCK_CHARACTERS;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: () => void;
  logout: () => void;
  selectCharacter: (characterId: string) => CharacterProfile | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<CharacterProfile | null>(null);
  const [characters] = useState(MOCK_CHARACTERS);

  const saveState = useCallback(
    (newUser: User | null, newProfile: CharacterProfile | null) => {
      // Keep state exclusively in React memory — NO localStorage for profile/user data
      setUser(newUser);
      setCurrentProfile(newProfile);

      if (newUser && newProfile) {
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

  useEffect(() => {
    // Purge legacy localStorage auth cache if present
    try {
      localStorage.removeItem('sanboard-auth-state');
    } catch {
      // Ignore
    }

    // Single source of truth: Hydrate session directly from Supabase /api/user/profile
    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
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
        }
      })
      .catch(() => {});
  }, []);

  const login = () => {
    // Mock login defaults to admin session
    const mockUser =
      MOCK_CHARACTER_ACCOUNTS['44444444-4444-4444-4444-444444444441'] ||
      MOCK_CHARACTER_ACCOUNTS['char-mavis-01'];
    setUser(mockUser);
    selectCharacter('44444444-4444-4444-4444-444444444441');
  };

  const logout = () => {
    saveState(null, null);
    window.location.href = '/';
  };

  const selectCharacter = (characterId: string): CharacterProfile | null => {
    const char = characters.find((c) => c.id === characterId);
    if (!char) return null;

    // Resolve user account and role from the account mapping
    const linkedUser: User = MOCK_CHARACTER_ACCOUNTS[characterId] || {
      id: `usr-${characterId}`,
      provider: 'GTAWORLD',
      role: 'USER',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (char.hasProfile) {
      const existingAvatar =
        (currentProfile?.id === char.id
          ? currentProfile.avatar_path || currentProfile.avatar_url
          : null) || null;

      const profile: CharacterProfile = {
        id: char.id,
        user_id: linkedUser.id,
        external_character_id: char.id,
        full_name: char.fullName,
        avatar_path: existingAvatar || '',
        avatar_url: existingAvatar ? resolveMediaUrl(existingAvatar) : '',
        sanmail_email:
          char.sanmailEmail || `${char.fullName.toLowerCase().replace(' ', '.')}@sanmail.com`,
        phone: char.phone || '555-0100',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      saveState(linkedUser, profile);

      // Hydrate authoritative profile directly from Supabase
      fetch(`/api/user/profile?profileId=${char.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data.profile) {
            saveState(linkedUser, data.profile);
          }
        })
        .catch(() => {});

      return profile;
    }

    return null;
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

  return (
    <AuthContext.Provider
      value={{
        user,
        currentProfile,
        characters,
        isAuthenticated: Boolean(user && currentProfile),
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

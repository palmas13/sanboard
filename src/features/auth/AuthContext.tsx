'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CharacterProfile, User } from '@/types';
import { GtaWorldCharacter } from '@/lib/integrations/gtaworld/types';
import { MOCK_CHARACTERS } from '@/lib/integrations/gtaworld/mock-provider';
import { resolveMediaUrl } from '@/lib/media/url';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  currentProfile: CharacterProfile | null;
  characters: GtaWorldCharacter[];
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
  refreshCharacters: () => Promise<GtaWorldCharacter[] | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_CHARACTER_ACCOUNTS: Record<string, User> = {
  // Admin Account (Mavis in seed.sql)
  '44444444-4444-4444-4444-444444444441': {
    id: '22222222-2222-2222-2222-222222222222',
    provider: 'GTAWORLD',
    role: 'ADMIN',
    status: 'ACTIVE',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  'char-mavis-01': {
    id: '22222222-2222-2222-2222-222222222222',
    provider: 'GTAWORLD',
    role: 'ADMIN',
    status: 'ACTIVE',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  // Character on same admin account
  '44444444-4444-4444-4444-444444444442': {
    id: '22222222-2222-2222-2222-222222222222',
    provider: 'GTAWORLD',
    role: 'ADMIN',
    status: 'ACTIVE',
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
  },
  'char-zade-02': {
    id: '22222222-2222-2222-2222-222222222222',
    provider: 'GTAWORLD',
    role: 'ADMIN',
    status: 'ACTIVE',
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
  },
  // Standard User Account (Ravi Blumon & standard users - strictly USER role)
  '44444444-4444-4444-4444-444444444443': {
    id: '33333333-3333-3333-3333-333333333333',
    provider: 'GTAWORLD',
    role: 'USER',
    status: 'ACTIVE',
    created_at: '2026-09-15T10:00:00Z',
    updated_at: '2026-09-15T10:00:00Z',
  },
  'b0de6077-d32b-42dc-909f-d12719749f96': {
    id: '33333333-3333-3333-3333-333333333333',
    provider: 'GTAWORLD',
    role: 'USER',
    status: 'ACTIVE',
    created_at: '2026-09-15T10:00:00Z',
    updated_at: '2026-09-15T10:00:00Z',
  },
  'char-ravi-03': {
    id: '33333333-3333-3333-3333-333333333333',
    provider: 'GTAWORLD',
    role: 'USER',
    status: 'ACTIVE',
    created_at: '2026-09-15T10:00:00Z',
    updated_at: '2026-09-15T10:00:00Z',
  },
};

export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: User | null;
  initialProfile?: CharacterProfile | null;
  initialStatus?: AuthStatus;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialProfile = null,
  initialStatus,
}: AuthProviderProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    initialProfile ? 'authenticated' : (initialStatus || 'loading')
  );
  const [user, setUser] = useState<User | null>(initialUser);
  const [currentProfile, setCurrentProfile] = useState<CharacterProfile | null>(initialProfile);
  const [characterProfiles, setCharacterProfiles] = useState<Record<string, CharacterProfile>>(
    initialProfile ? { [initialProfile.id]: initialProfile } : {}
  );
  const [characters, setCharacters] = useState<GtaWorldCharacter[]>(MOCK_CHARACTERS);

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
    const profileId = currentProfile?.id;
    if (!profileId) return;
    try {
      const res = await fetch(`/api/user/profile?profileId=${profileId}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data.profile) {
          const updated = data.profile as CharacterProfile;
          setCurrentProfile(updated);
          setCharacterProfiles((prev) => ({
            ...prev,
            [updated.id]: updated,
          }));
        }
      }
    } catch {
      // Ignore network errors on background refresh
    }
  }, [currentProfile]);

  // Initial session hydration: runs strictly ONCE on mount
  useEffect(() => {
    let isMounted = true;

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

    async function initSession() {
      // If initialProfile was provided from server bootstrap, do not double-fetch
      if (initialProfile && isMounted) {
        try {
          const charRes = await fetch('/api/user/characters');
          if (charRes.ok && isMounted) {
            const charData = await charRes.json();
            if (charData?.success && Array.isArray(charData.characters) && charData.characters.length > 0) {
              setCharacters(charData.characters);
            }
          }
        } catch {
          // Ignore
        }
        return;
      }

      try {
        const res = await fetch('/api/user/profile');
        if (!isMounted) return;

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

            // Load authorized characters once in background
            try {
              const charRes = await fetch('/api/user/characters');
              if (charRes.ok && isMounted) {
                const charData = await charRes.json();
                if (charData?.success && Array.isArray(charData.characters) && charData.characters.length > 0) {
                  setCharacters(charData.characters);
                }
              }
            } catch {
              // Ignore background character errors
            }
            return;
          }
        }

        setAuthStatus('unauthenticated');
        try {
          const charRes = await fetch('/api/user/characters');
          if (charRes.ok && isMounted) {
            const charData = await charRes.json();
            if (charData?.success && Array.isArray(charData.characters) && charData.characters.length > 0) {
              setCharacters(charData.characters);
            }
          }
        } catch {
          // Ignore
        }
      } catch {
        if (isMounted) {
          setAuthStatus('unauthenticated');
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectCharacter = async (characterId: string): Promise<CharacterProfile | null> => {
    const char = characters.find((c) => c.id === characterId) || {
      id: characterId,
      fullName: 'Karakter',
      hasProfile: true,
    };

    try {
      // 1. Establish server-side signed HMAC session first and await confirmation
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, profileId: characterId }),
      });

      if (!sessionRes.ok) {
        return null;
      }

      const sessionData = await sessionRes.json();
      const userId = sessionData.user?.id || user?.id || (characterId.startsWith('usr-') ? characterId : `usr-${characterId}`);
      const role = (sessionData.user?.role || user?.role || 'USER') as 'USER' | 'ADMIN';

      const linkedUser: User = {
        id: userId,
        provider: 'GTAWORLD',
        role,
        status: 'ACTIVE',
        created_at: user?.created_at || new Date().toISOString(),
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
          sanmail_email: char.sanmailEmail || '',
          phone: char.phone || '',
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

      // Refresh characters in background to keep hasProfile up-to-date
      fetch('/api/user/characters')
        .then((r) => r.json())
        .then((d) => {
          if (d?.success && Array.isArray(d.characters)) setCharacters(d.characters);
        })
        .catch(() => {});

      return profile;
    } catch (err) {
      console.error('Character switch error:', err);
      return null;
    }
  };

  const login = async () => {
    window.location.href = '/api/auth/gtaworld/login';
  };

  const logout = async () => {
    saveState(null, null);
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    window.location.href = '/';
  };

  const updateCurrentProfile = useCallback((data: Partial<CharacterProfile>) => {
    setCurrentProfile((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        ...data,
        updated_at: new Date().toISOString(),
      };
      if (updated.avatar_path && !updated.avatar_url) {
        updated.avatar_url = resolveMediaUrl(updated.avatar_path);
      }
      setCharacterProfiles((prevMap) => ({
        ...prevMap,
        [updated.id]: updated,
      }));
      return updated;
    });
  }, []);

  const refreshCharacters = useCallback(async (): Promise<GtaWorldCharacter[] | null> => {
    try {
      const res = await fetch('/api/user/characters');
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.characters) && data.characters.length > 0) {
          setCharacters(data.characters);
          return data.characters;
        }
      }
    } catch {
      // Ignore background errors
    }
    return null;
  }, []);

  const isAuthenticated = authStatus === 'authenticated' && Boolean(user);
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
        refreshCharacters,
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

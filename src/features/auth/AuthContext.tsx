'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CharacterProfile, User } from '@/types';
import { GtaWorldCharacter } from '@/lib/integrations/gtaworld/types';
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
  isTestIdentity: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  selectCharacter: (characterId: string) => Promise<CharacterProfile | null>;
  updateCurrentProfile: (data: Partial<CharacterProfile>) => void;
  refreshProfile: () => Promise<void>;
  refreshCharacters: () => Promise<GtaWorldCharacter[] | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const [characters, setCharacters] = useState<GtaWorldCharacter[]>([]);
  const [isTestIdentity, setIsTestIdentity] = useState(false);

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
            ...(updated.external_character_id ? { [updated.external_character_id]: updated } : {}),
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
      // If a protected segment supplied initial auth data, only hydrate the
      // character switcher in the background. Public root layout intentionally
      // does not block on auth/profile database reads.
      if (initialProfile && isMounted) {
        try {
          const charRes = await fetch('/api/user/characters');
          if (charRes.ok && isMounted) {
            const charData = await charRes.json();
            if (charData?.success && Array.isArray(charData.characters)) {
              setCharacters(charData.characters);
            }
            setIsTestIdentity(charData?.isTestIdentity === true);
            if (charData?.success && Array.isArray(charData.profiles)) {
              const profMap: Record<string, CharacterProfile> = {};
              for (const p of charData.profiles as CharacterProfile[]) {
                if (p.id) profMap[p.id] = p;
                if (p.external_character_id) profMap[p.external_character_id] = p;
              }
              setCharacterProfiles((prev) => ({ ...prev, ...profMap }));
            }
          }
        } catch {
          // Ignore
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/session');
        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          if (data?.authenticated && data.profile && data.user) {
            const profile = data.profile as CharacterProfile;
            const linkedUser: User = {
              ...data.user,
              id: data.session.userId,
              provider: 'GTAWORLD',
              role: profile.role || data.session.role || 'USER',
              status: 'ACTIVE',
            };

            setUser(linkedUser);
            setCurrentProfile(profile);
            setCharacterProfiles((prev) => ({
              ...prev,
              [profile.id]: profile,
              ...(profile.external_character_id ? { [profile.external_character_id]: profile } : {}),
            }));
            setAuthStatus('authenticated');
            setIsTestIdentity(data?.isTestIdentity === true);

            return;
          }
        }

        setAuthStatus('unauthenticated');
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
      const userId = sessionData.user?.id;
      const role = (sessionData.user?.role || 'USER') as 'USER' | 'ADMIN';
      if (!userId) return null;

      const linkedUser: User = {
        id: userId,
        provider: 'GTAWORLD',
        role,
        status: 'ACTIVE',
        created_at: user?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const profile = sessionData.profile as CharacterProfile | undefined;
      if (!profile) return null;

      setUser(linkedUser);
      setCurrentProfile(profile);
      setCharacterProfiles((prev) => ({ ...prev, [profile.id]: profile }));
      setAuthStatus('authenticated');
      setIsTestIdentity(sessionData?.isTestIdentity === true);

      // Set client routing cookies
      document.cookie = `sanboard_profile_id=${profile.id}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `sanboard_user_id=${linkedUser.id}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `sanboard_role=${linkedUser.role}; path=/; max-age=86400; SameSite=Lax`;

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
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    setUser(null);
    setCurrentProfile(null);
    setCharacters([]);
    setCharacterProfiles({});
    setIsTestIdentity(false);
    setAuthStatus('unauthenticated');
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
        if (data?.success && Array.isArray(data.characters)) {
          setCharacters(data.characters);
        }
        setIsTestIdentity(data?.isTestIdentity === true);
        if (data?.success && Array.isArray(data.profiles)) {
          const profMap: Record<string, CharacterProfile> = {};
          for (const p of data.profiles as CharacterProfile[]) {
            if (p.id) profMap[p.id] = p;
            if (p.external_character_id) profMap[p.external_character_id] = p;
          }
          setCharacterProfiles((prev) => ({ ...prev, ...profMap }));
        }
        return data.characters || null;
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
        isAdmin: currentProfile?.role === 'ADMIN',
        isTestIdentity,
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

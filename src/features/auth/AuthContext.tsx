'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CharacterProfile, User } from '@/types';
import { MOCK_CHARACTERS } from '@/lib/integrations/gtaworld/mock-provider';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_AUTH = 'sanboard-auth-state';

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
  const [characters, setCharacters] = useState(MOCK_CHARACTERS);

  useEffect(() => {
    // Load persisted auth from localStorage on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTH);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUser(parsed.user);
        setCurrentProfile(parsed.currentProfile);
      }
    } catch {
      // Ignore parse error
    }
  }, []);

  const saveState = (newUser: User | null, newProfile: CharacterProfile | null) => {
    setUser(newUser);
    setCurrentProfile(newProfile);
    if (newUser && newProfile) {
      localStorage.setItem(
        STORAGE_KEY_AUTH,
        JSON.stringify({ user: newUser, currentProfile: newProfile })
      );
      // Set cookies for server actions & SSR route guards
      document.cookie = `sanboard_profile_id=${newProfile.id}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `sanboard_user_id=${newUser.id}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `sanboard_role=${newUser.role}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      document.cookie = `sanboard_profile_id=; path=/; max-age=0; SameSite=Lax`;
      document.cookie = `sanboard_user_id=; path=/; max-age=0; SameSite=Lax`;
      document.cookie = `sanboard_role=; path=/; max-age=0; SameSite=Lax`;
    }
  };

  const login = () => {
    // Mock login defaults to admin session
    const mockUser = MOCK_CHARACTER_ACCOUNTS['char-mavis-01'];
    setUser(mockUser);
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
      const profile: CharacterProfile = {
        id: char.id,
        user_id: linkedUser.id,
        external_character_id: char.id,
        full_name: char.fullName,
        avatar_url: char.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80',
        sanmail_email: char.sanmailEmail || `${char.fullName.toLowerCase().replace(' ', '.')}@sanmail.com`,
        phone: char.phone || '555-0100',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveState(linkedUser, profile);
      return profile;
    }

    return null;
  };

  const updateCurrentProfile = (data: Partial<CharacterProfile>) => {
    if (!currentProfile) return;
    const updated = { ...currentProfile, ...data, updated_at: new Date().toISOString() };
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

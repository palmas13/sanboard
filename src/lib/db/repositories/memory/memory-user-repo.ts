import { IUserRepository } from '../types';
import { db } from '../../store';
import { CharacterProfile, User } from '@/types';

export class MemoryUserRepository implements IUserRepository {
  async getUserById(id: string): Promise<User | null> {
    const user = db.users.find((u) => u.id === id);
    return user || null;
  }

  async getProfileById(id: string): Promise<CharacterProfile | null> {
    const profile = db.profiles.find(
      (p) => p.id === id || p.external_character_id === id
    );
    if (profile) return profile;

    if (id === '44444444-4444-4444-4444-444444444441') {
      return db.profiles.find((p) => p.id === 'char-mavis-01') || null;
    }
    if (id === '44444444-4444-4444-4444-444444444442') {
      return db.profiles.find((p) => p.id === 'char-zade-02') || null;
    }

    return null;
  }

  async getProfilesByUserId(userId: string): Promise<CharacterProfile[]> {
    return db.profiles.filter((p) => p.user_id === userId);
  }

  async updateProfile(
    id: string,
    data: Partial<CharacterProfile>
  ): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }> {
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile) return { success: false, error: 'Profil bulunamadı.' };

    if (data.avatar_path && !data.avatar_url) {
      data.avatar_url = data.avatar_path;
    } else if (data.avatar_url && !data.avatar_path) {
      data.avatar_path = data.avatar_url;
    }

    Object.assign(profile, data, { updated_at: new Date().toISOString() });
    return { success: true, profile };
  }

  async createProfile(data: {
    userId: string;
    fullName: string;
    externalCharacterId?: string;
    avatarData?: string;
    sanmailEmail?: string;
    phone?: string;
  }): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }> {
    const trimmedName = data.fullName.trim();
    const extId = data.externalCharacterId ? String(data.externalCharacterId) : undefined;

    let profile = db.profiles.find(
      (p) =>
        p.user_id === data.userId &&
        (p.id === extId || p.external_character_id === extId || p.full_name.toLowerCase() === trimmedName.toLowerCase())
    );

    const now = new Date().toISOString();
    if (profile) {
      if (data.sanmailEmail !== undefined) profile.sanmail_email = data.sanmailEmail;
      if (data.phone !== undefined) profile.phone = data.phone;
      if (data.avatarData) {
        profile.avatar_url = data.avatarData;
        profile.avatar_path = data.avatarData;
      }
      profile.updated_at = now;
      return { success: true, profile };
    }

    const newId = extId || `char-${Date.now()}`;
    profile = {
      id: newId,
      user_id: data.userId,
      external_character_id: extId,
      full_name: trimmedName,
      avatar_path: data.avatarData || '',
      avatar_url: data.avatarData || '',
      sanmail_email: data.sanmailEmail || '',
      phone: data.phone || '',
      is_dealer: false,
      created_at: now,
      updated_at: now,
    };

    db.profiles.push(profile);
    return { success: true, profile };
  }
}

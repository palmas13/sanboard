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
}

import { IUserRepository } from '../types';
import { db } from '../../store';
import { CharacterProfile, User } from '@/types';

export class MemoryUserRepository implements IUserRepository {
  async getUserById(id: string): Promise<User | null> {
    const user = db.users.find((u) => u.id === id);
    return user || null;
  }

  async getProfileById(id: string): Promise<CharacterProfile | null> {
    const profile = db.profiles.find((p) => p.id === id);
    return profile || null;
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

    Object.assign(profile, data, { updated_at: new Date().toISOString() });
    return { success: true, profile };
  }
}

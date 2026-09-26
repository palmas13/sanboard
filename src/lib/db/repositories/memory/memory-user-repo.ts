import { IUserRepository } from '../types';
import { db } from '../../store';
import { CharacterProfile, User } from '@/types';
import { normalizePhone } from '@/lib/utils/format';
import { resolveUserId, resolveStoreUserId, resolveStoreProfileId } from '../../id-mapper';
import { selectUnambiguousProfile } from '../../profile-identity';

export class MemoryUserRepository implements IUserRepository {
  async getUserById(id: string): Promise<User | null> {
    const storeId = resolveStoreUserId(id);
    const uuid = resolveUserId(id);
    const user = db.users.find((u) => u.id === id || u.id === storeId || u.id === uuid);
    return user || null;
  }

  async getProfileById(id: string): Promise<CharacterProfile | null> {
    const identifier = String(id || '').trim();
    if (!identifier) return null;

    const storeProfileId = resolveStoreProfileId(id);
    const canonicalProfile = db.profiles.find((profile) => profile.id === identifier) || null;
    const externalProfile = db.profiles.find(
      (profile) => profile.external_character_id === identifier
    ) || null;
    const profile = selectUnambiguousProfile(identifier, canonicalProfile, externalProfile);
    if (profile) return profile;

    const mappedProfile = db.profiles.find((candidate) => candidate.id === storeProfileId);
    if (mappedProfile) return mappedProfile;

    if (id === '44444444-4444-4444-4444-444444444441') {
      return db.profiles.find((p) => p.id === 'char-mavis-01') || null;
    }
    if (id === '44444444-4444-4444-4444-444444444442') {
      return db.profiles.find((p) => p.id === 'char-zade-02') || null;
    }
    if (id === '44444444-4444-4444-4444-444444444443') {
      return db.profiles.find((p) => p.id === 'char-ravi-03') || null;
    }

    return null;
  }

  async getProfileByPublicId(publicId: number): Promise<CharacterProfile | null> {
    const profile = db.profiles.find((p) => p.public_id === publicId);
    if (profile) return profile;

    if (publicId === 1) return db.profiles.find((p) => p.id === 'char-mavis-01') || null;
    if (publicId === 2) return db.profiles.find((p) => p.id === 'char-zade-02') || null;
    if (publicId === 3) return db.profiles.find((p) => p.id === 'char-ravi-03') || null;

    return null;
  }

  async getProfilesByUserId(userId: string): Promise<CharacterProfile[]> {
    const storeId = resolveStoreUserId(userId);
    const uuid = resolveUserId(userId);
    return db.profiles.filter((p) => p.user_id === userId || p.user_id === storeId || p.user_id === uuid);
  }

  async updateProfile(
    id: string,
    data: Partial<CharacterProfile>
  ): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }> {
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile) return { success: false, error: 'Profil bulunamadı.' };

    if (data.sanmail_email && data.sanmail_email.trim()) {
      const emailLower = data.sanmail_email.trim().toLowerCase();
      const existing = db.profiles.find(
        (p) => p.id !== id && p.sanmail_email && p.sanmail_email.trim().toLowerCase() === emailLower
      );
      if (existing) {
        return { success: false, error: 'Bu SanMail adresi başka bir karakter tarafından kullanılmaktadır.' };
      }
    }

    if (data.phone !== undefined) {
      const normalizedPhone = normalizePhone(data.phone);
      if (normalizedPhone) {
        const existing = db.profiles.find(
          (p) => p.id !== id && p.phone && normalizePhone(p.phone) === normalizedPhone
        );
        if (existing) {
          return { success: false, error: 'Bu telefon numarası başka bir karakter tarafından kullanılmaktadır.' };
        }
      }
      profile.phone = normalizedPhone;
    }

    if (data.avatar_path && !data.avatar_url) {
      data.avatar_url = data.avatar_path;
    } else if (data.avatar_url && !data.avatar_path) {
      data.avatar_path = data.avatar_url;
    }

    const { phone: _, ...rest } = data;
    Object.assign(profile, rest, { updated_at: new Date().toISOString() });
    return { success: true, profile };
  }

  async createProfile(data: {
    userId: string;
    fullName: string;
    externalCharacterId?: string;
    avatarData?: string;
    sanmailEmail?: string;
    phone?: string;
    role?: 'USER' | 'ADMIN';
  }): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }> {
    const trimmedName = data.fullName.trim();
    const extId = data.externalCharacterId ? String(data.externalCharacterId) : undefined;

    if (data.sanmailEmail && data.sanmailEmail.trim()) {
      const emailLower = data.sanmailEmail.trim().toLowerCase();
      const existing = db.profiles.find(
        (p) => p.sanmail_email && p.sanmail_email.trim().toLowerCase() === emailLower && p.id !== extId
      );
      if (existing) {
        return { success: false, error: 'Bu SanMail adresi başka bir karakter tarafından kullanılmaktadır.' };
      }
    }

    const normalizedPhone = normalizePhone(data.phone);
    if (normalizedPhone) {
      const existing = db.profiles.find(
        (p) => p.phone && normalizePhone(p.phone) === normalizedPhone && p.id !== extId
      );
      if (existing) {
        return { success: false, error: 'Bu telefon numarası başka bir karakter tarafından kullanılmaktadır.' };
      }
    }

    let profile = db.profiles.find(
      (p) =>
        p.user_id === data.userId &&
        (p.id === extId || p.external_character_id === extId || p.full_name.toLowerCase() === trimmedName.toLowerCase())
    );

    const now = new Date().toISOString();
    if (profile) {
      if (data.sanmailEmail !== undefined) profile.sanmail_email = data.sanmailEmail;
      if (data.phone !== undefined) profile.phone = normalizedPhone;
      if (data.avatarData) {
        profile.avatar_url = data.avatarData;
        profile.avatar_path = data.avatarData;
      }
      if (data.role) profile.role = data.role;
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
      phone: normalizedPhone,
      role: data.role || 'USER',
      is_dealer: false,
      created_at: now,
      updated_at: now,
    };

    db.profiles.push(profile);
    return { success: true, profile };
  }
}

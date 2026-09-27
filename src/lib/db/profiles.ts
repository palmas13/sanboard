import { db } from './store';
import { CharacterProfile } from '@/types';

export async function getProfileById(profileId: string): Promise<CharacterProfile | null> {
  return db.profiles.find((p) => p.id === profileId) || null;
}

export async function getProfilesByUserId(userId: string): Promise<CharacterProfile[]> {
  return db.profiles.filter((p) => p.user_id === userId);
}

export async function createCharacterProfile(
  userId: string,
  data: {
    fullName: string;
    avatarUrl: string;
    sanmailEmail: string;
    phone: string;
    externalCharacterId?: string;
  }
): Promise<CharacterProfile> {
  const profile: CharacterProfile = {
    id: data.externalCharacterId || `char-${Date.now()}`,
    user_id: userId,
    external_character_id: data.externalCharacterId,
    full_name: data.fullName,
    avatar_url: data.avatarUrl,
    sanmail_email: data.sanmailEmail,
    phone: data.phone,
    phone_visibility: 'PUBLIC',
    sanmail_visibility: 'PUBLIC',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.profiles.push(profile);
  return profile;
}

export async function updateProfile(
  profileId: string,
  data: Partial<Pick<CharacterProfile, 'avatar_url' | 'sanmail_email' | 'phone' | 'phone_visibility' | 'sanmail_visibility'>>
): Promise<CharacterProfile | null> {
  const profile = db.profiles.find((p) => p.id === profileId);
  if (!profile) return null;

  if (data.avatar_url) profile.avatar_url = data.avatar_url;
  if (data.sanmail_email) profile.sanmail_email = data.sanmail_email;
  if (data.phone) profile.phone = data.phone;
  if (data.phone_visibility) profile.phone_visibility = data.phone_visibility;
  if (data.sanmail_visibility) profile.sanmail_visibility = data.sanmail_visibility;
  profile.updated_at = new Date().toISOString();

  return profile;
}

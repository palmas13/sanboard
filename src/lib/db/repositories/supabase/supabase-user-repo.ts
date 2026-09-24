import { IUserRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { CharacterProfile, User } from '@/types';
import { uploadProfileAvatar, getStorageProvider } from '@/lib/storage';
import { resolveUserId, resolveProfileId, isUuid } from '../../id-mapper';

export class SupabaseUserRepository implements IUserRepository {
  private getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        'Supabase client is not initialized. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.'
      );
    }
    return client;
  }

  private getAdminClient() {
    const admin = getSupabaseAdminClient();
    if (admin) return admin;
    return this.getClient();
  }

  async getUserById(id: string): Promise<User | null> {
    const client = this.getAdminClient();
    const safeId = resolveUserId(id);
    if (!isUuid(safeId)) return null;

    const { data, error } = await client.from('users').select('*').eq('id', safeId).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching user: ${error.message}`);
    }
    return data as User | null;
  }

  async getProfileById(id: string): Promise<CharacterProfile | null> {
    const client = this.getAdminClient();
    const safeId = resolveProfileId(id);
    if (!isUuid(safeId)) return null;

    const { data, error } = await client.from('character_profiles').select('*').eq('id', safeId).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching character profile: ${error.message}`);
    }
    if (!data) return null;

    const profile = data as CharacterProfile;
    // Canonicalize avatar_path so UI can always read avatar_path
    if (!profile.avatar_path && profile.avatar_url) {
      profile.avatar_path = profile.avatar_url;
    }
    return profile;
  }

  async getProfilesByUserId(userId: string): Promise<CharacterProfile[]> {
    const client = this.getAdminClient();
    const safeUserId = resolveUserId(userId);
    if (!isUuid(safeUserId)) return [];

    const { data, error } = await client.from('character_profiles').select('*').eq('user_id', safeUserId);
    if (error) {
      throw new Error(`Supabase error fetching profiles for user: ${error.message}`);
    }
    return ((data || []) as CharacterProfile[]).map((p) => {
      if (!p.avatar_path && p.avatar_url) {
        p.avatar_path = p.avatar_url;
      }
      return p;
    });
  }

  async updateProfile(
    id: string,
    data: Partial<CharacterProfile>
  ): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }> {
    const client = this.getAdminClient();
    const safeId = resolveProfileId(id);
    if (!isUuid(safeId)) {
      return { success: false, error: 'Geçersiz character/profile ID.' };
    }

    // 1. Fetch current profile to capture old avatar for cleanup
    const existing = await this.getProfileById(safeId);
    if (!existing) {
      return { success: false, error: 'Profil bulunamadı.' };
    }
    const oldAvatarKey = existing.avatar_path || existing.avatar_url;

    let newAvatarKey: string | null = null;
    let isNewUpload = false;

    // 2. Check if avatar is being updated with a new image (data URL or base64)
    const incomingAvatar = data.avatar_path || data.avatar_url;
    if (incomingAvatar && typeof incomingAvatar === 'string' && incomingAvatar.startsWith('data:image/')) {
      const matches = incomingAvatar.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const mime = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const uploadRes = await uploadProfileAvatar(buffer, safeId, mime);

        if (!uploadRes.success) {
          return { success: false, error: `R2 avatar yükleme hatası: ${uploadRes.error}` };
        }

        newAvatarKey = uploadRes.key;
        isNewUpload = true;
      }
    } else if (incomingAvatar && typeof incomingAvatar === 'string' && incomingAvatar.trim()) {
      newAvatarKey = incomingAvatar.trim();
    }

    // 3. Prepare payload for Supabase update
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.sanmail_email !== undefined) updatePayload.sanmail_email = data.sanmail_email;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.full_name !== undefined) updatePayload.full_name = data.full_name;

    if (newAvatarKey !== null) {
      updatePayload.avatar_path = newAvatarKey;
      updatePayload.avatar_url = newAvatarKey;
    }

    // 4. Execute Supabase update
    let updatedProfile: CharacterProfile | null = null;
    let { data: updated, error } = await client
      .from('character_profiles')
      .update(updatePayload)
      .eq('id', safeId)
      .select()
      .maybeSingle();

    // If avatar_path column does not exist yet in live DB (code 42703), retry updating avatar_url only
    if (error && (error.code === '42703' || error.message.includes('avatar_path'))) {
      delete updatePayload.avatar_path;
      const retryResult = await client
        .from('character_profiles')
        .update(updatePayload)
        .eq('id', safeId)
        .select()
        .maybeSingle();
      updated = retryResult.data;
      error = retryResult.error;
    }

    // 5. Handle update failure -> clean up orphan object if we just uploaded it
    if (error || !updated) {
      if (isNewUpload && newAvatarKey) {
        try {
          const storage = getStorageProvider();
          await storage.delete(newAvatarKey);
        } catch {
          // ignore cleanup error
        }
      }
      return { success: false, error: error?.message || 'Profil güncellenemedi.' };
    }

    updatedProfile = updated as CharacterProfile;
    if (!updatedProfile.avatar_path && updatedProfile.avatar_url) {
      updatedProfile.avatar_path = updatedProfile.avatar_url;
    }

    // 6. DB update succeeded -> safely delete old avatar from R2 if replaced
    if (isNewUpload && oldAvatarKey && oldAvatarKey !== newAvatarKey) {
      try {
        const storage = getStorageProvider();
        await storage.delete(oldAvatarKey);
      } catch {
        // Non-blocking cleanup
      }
    }

    return { success: true, profile: updatedProfile };
  }
}

import { IUserRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { CharacterProfile, User } from '@/types';
import { uploadProfileAvatar } from '@/lib/storage';
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
    return data as CharacterProfile | null;
  }

  async getProfilesByUserId(userId: string): Promise<CharacterProfile[]> {
    const client = this.getAdminClient();
    const safeUserId = resolveUserId(userId);
    if (!isUuid(safeUserId)) return [];

    const { data, error } = await client.from('character_profiles').select('*').eq('user_id', safeUserId);
    if (error) {
      throw new Error(`Supabase error fetching profiles for user: ${error.message}`);
    }
    return (data || []) as CharacterProfile[];
  }

  async updateProfile(id: string, data: Partial<CharacterProfile>): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }> {
    const client = this.getAdminClient();
    const safeId = resolveProfileId(id);

    let finalAvatarUrl = data.avatar_url;
    if (finalAvatarUrl && finalAvatarUrl.startsWith('data:image/')) {
      const matches = finalAvatarUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const buffer = Buffer.from(matches[2], 'base64');
        const uploadRes = await uploadProfileAvatar(buffer, `avatar-${id}-${Date.now()}.jpg`, matches[1]);
        if (uploadRes.success) {
          finalAvatarUrl = uploadRes.url;
        } else {
          return { success: false, error: `R2 avatar yükleme hatası: ${uploadRes.error}` };
        }
      }
    }

    const updatePayload: any = {
      ...data,
      avatar_url: finalAvatarUrl,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await client
      .from('character_profiles')
      .update(updatePayload)
      .eq('id', safeId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, profile: updated as CharacterProfile };
  }
}

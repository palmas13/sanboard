import { IUserRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { CharacterProfile, User } from '@/types';
import { uploadProfileAvatar } from '@/lib/storage';
import { deleteMediaSafely } from '@/lib/storage/lifecycle';
import { normalizePhone } from '@/lib/utils/format';
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

    const { data, error } = await client
      .from('character_profiles')
      .select('*')
      .or(`id.eq.${safeId},external_character_id.eq.${safeId}`)
      .maybeSingle();

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

  async getProfileByPublicId(publicId: number): Promise<CharacterProfile | null> {
    const client = this.getAdminClient();
    if (!publicId || isNaN(publicId)) return null;

    const { data, error } = await client
      .from('character_profiles')
      .select('*')
      .eq('public_id', publicId)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message.includes('public_id')) {
        return null;
      }
      throw new Error(`Supabase error fetching profile by public_id: ${error.message}`);
    }
    if (!data) return null;

    const profile = data as CharacterProfile;
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

    if (data.sanmail_email && data.sanmail_email.trim()) {
      const emailLower = data.sanmail_email.trim().toLowerCase();
      const { data: existingSanmail } = await client
        .from('character_profiles')
        .select('id')
        .ilike('sanmail_email', emailLower)
        .neq('id', safeId)
        .maybeSingle();

      if (existingSanmail) {
        if (isNewUpload && newAvatarKey) await deleteMediaSafely(newAvatarKey, 'AVATAR', 'AVATAR_UPLOAD_ROLLBACK');
        return { success: false, error: 'Bu SanMail adresi başka bir karakter tarafından kullanılmaktadır.' };
      }
    }

    // 3. Prepare payload for Supabase update
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.sanmail_email !== undefined) updatePayload.sanmail_email = data.sanmail_email;
    if (data.full_name !== undefined) updatePayload.full_name = data.full_name;

    if (data.phone !== undefined) {
      const normalizedPhone = normalizePhone(data.phone);
      if (normalizedPhone) {
        const { data: existingPhone } = await client
          .from('character_profiles')
          .select('id')
          .eq('phone', normalizedPhone)
          .neq('id', safeId)
          .maybeSingle();

        if (existingPhone) {
          if (isNewUpload && newAvatarKey) await deleteMediaSafely(newAvatarKey, 'AVATAR', 'AVATAR_UPLOAD_ROLLBACK');
          return { success: false, error: 'Bu telefon numarası başka bir karakter tarafından kullanılmaktadır.' };
        }
      }
      updatePayload.phone = normalizedPhone || '';
    }

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
        await deleteMediaSafely(newAvatarKey, 'AVATAR', 'AVATAR_UPLOAD_ROLLBACK');
      }
      return { success: false, error: error?.message || 'Profil güncellenemedi.' };
    }

    updatedProfile = updated as CharacterProfile;
    if (!updatedProfile.avatar_path && updatedProfile.avatar_url) {
      updatedProfile.avatar_path = updatedProfile.avatar_url;
    }

    // 6. DB update succeeded -> safely delete old avatar from R2 if replaced
    if (isNewUpload && oldAvatarKey && oldAvatarKey !== newAvatarKey) {
      await deleteMediaSafely(oldAvatarKey, 'AVATAR', 'AVATAR_REPLACED');
    }

    return { success: true, profile: updatedProfile };
  }

  async createProfile(data: {
    userId: string;
    fullName: string;
    externalCharacterId?: string;
    avatarData?: string;
    sanmailEmail?: string;
    phone?: string;
  }): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }> {
    const client = this.getAdminClient();
    const safeUserId = resolveUserId(data.userId);
    if (!isUuid(safeUserId)) {
      return { success: false, error: 'Geçersiz kullanıcı ID.' };
    }

    if (!data.fullName || !data.fullName.trim()) {
      return { success: false, error: 'Karakter adı zorunludur.' };
    }

    const trimmedName = data.fullName.trim();
    const extId = data.externalCharacterId ? String(data.externalCharacterId) : null;

    // 1. Idempotency check: Does profile already exist for this user & character?
    const { data: existingProfiles } = await client
      .from('character_profiles')
      .select('*')
      .eq('user_id', safeUserId);

    const matched = (existingProfiles || []).find((p: any) => {
      if (extId && p.external_character_id === extId) return true;
      if (p.full_name?.toLowerCase() === trimmedName.toLowerCase()) return true;
      return false;
    });

    if (matched) {
      // Update with newly provided fields if present
      const updates: Partial<CharacterProfile> = {};
      if (data.sanmailEmail !== undefined) updates.sanmail_email = data.sanmailEmail;
      if (data.phone !== undefined) updates.phone = data.phone;
      if (data.avatarData) updates.avatar_url = data.avatarData;

      if (Object.keys(updates).length > 0) {
        return this.updateProfile(matched.id, updates);
      }

      if (!matched.avatar_path && matched.avatar_url) matched.avatar_path = matched.avatar_url;
      return { success: true, profile: matched as CharacterProfile };
    }

    if (data.sanmailEmail && data.sanmailEmail.trim()) {
      const emailLower = data.sanmailEmail.trim().toLowerCase();
      const { data: existingSanmail } = await client
        .from('character_profiles')
        .select('id')
        .ilike('sanmail_email', emailLower)
        .maybeSingle();

      if (existingSanmail) {
        return { success: false, error: 'Bu SanMail adresi başka bir karakter tarafından kullanılmaktadır.' };
      }
    }

    const normalizedPhone = normalizePhone(data.phone);
    if (normalizedPhone) {
      const { data: existingPhone } = await client
        .from('character_profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existingPhone) {
        return { success: false, error: 'Bu telefon numarası başka bir karakter tarafından kullanılmaktadır.' };
      }
    }

    // 2. Insert new character profile
    const insertPayload: Record<string, any> = {
      user_id: safeUserId,
      external_character_id: extId,
      full_name: trimmedName,
      avatar_path: null,
      avatar_url: null,
      sanmail_email: data.sanmailEmail?.trim() || null,
      phone: normalizedPhone || null,
      role: 'USER',
      is_dealer: false,
    };

    let { data: created, error: insertErr } = await client
      .from('character_profiles')
      .insert(insertPayload)
      .select()
      .single();

    // Defensive fallback: if remote live DB still has NOT NULL constraint pending migration execution
    if (insertErr && (insertErr.code === '23502' || insertErr.message?.includes('not-null'))) {
      insertPayload.sanmail_email = data.sanmailEmail?.trim() || '';
      insertPayload.phone = data.phone?.trim() || '';
      const retry = await client
        .from('character_profiles')
        .insert(insertPayload)
        .select()
        .single();
      created = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !created) {
      return { success: false, error: insertErr?.message || 'Profil oluşturulamadı.' };
    }

    let profile = created as CharacterProfile;

    // 3. If avatarData was provided, upload to R2 and update avatar_path
    if (data.avatarData && data.avatarData.startsWith('data:image/')) {
      const updateRes = await this.updateProfile(profile.id, {
        avatar_url: data.avatarData,
      });
      if (updateRes.success && updateRes.profile) {
        profile = updateRes.profile;
      }
    }

    if (!profile.avatar_path && profile.avatar_url) {
      profile.avatar_path = profile.avatar_url;
    }

    return { success: true, profile };
  }
}

import { randomUUID } from 'crypto';
import { CharacterProfile, User } from '@/types';
import { GtaWorldApiUser } from '@/lib/integrations/gtaworld/types';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';

export interface SyncGtaWorldResult {
  user: User;
  profiles: CharacterProfile[];
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export async function syncGtaWorldAccountAndCharacters(gtawUser: GtaWorldApiUser): Promise<SyncGtaWorldResult> {
  const externalUserId = String(gtawUser.id);
  const now = new Date().toISOString();

  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (!client) throw new Error('Supabase admin client is not configured for GTA World sync.');

    const findUser = async () => {
      const result = await client.from('users').select('*').eq('provider', 'GTAWORLD').eq('external_user_id', externalUserId).maybeSingle();
      if (result.error) throw new Error(`Failed to resolve GTA World account: ${result.error.message}`);
      return result.data as User | null;
    };

    let user = await findUser();
    if (!user) {
      const created = await client.from('users').insert({ provider: 'GTAWORLD', external_user_id: externalUserId, role: 'USER', status: 'ACTIVE', created_at: now, updated_at: now }).select().single();
      if (created.error) {
        if (!isUniqueViolation(created.error)) throw new Error(`Failed to create GTA World account: ${created.error.message}`);
        user = await findUser();
      } else {
        user = created.data as User;
      }
    }
    if (!user) throw new Error(`GTA World account conflict recovery failed for ${externalUserId}.`);

    for (const character of Array.isArray(gtawUser.character) ? gtawUser.character : []) {
      const externalCharacterId = String(character.id);
      const fullName = `${character.firstname.trim()} ${character.lastname.trim()}`.trim();
      const findProfile = async () => {
        const result = await client.from('character_profiles').select('*').eq('external_character_id', externalCharacterId).maybeSingle();
        if (result.error) throw new Error(`Failed to resolve GTA World character: ${result.error.message}`);
        return result.data as CharacterProfile | null;
      };

      let profile = await findProfile();
      if (profile && profile.user_id !== user.id) throw new Error(`GTA World character identity collision for external ID ${externalCharacterId}.`);

      if (profile) {
        const updated = await client.from('character_profiles').update({ full_name: fullName, updated_at: now }).eq('id', profile.id).eq('user_id', user.id).select().single();
        if (updated.error || !updated.data) throw new Error(`Failed to update GTA World character ${externalCharacterId}: ${updated.error?.message}`);
      } else {
        const inserted = await client.from('character_profiles').insert({ user_id: user.id, external_character_id: externalCharacterId, full_name: fullName, role: 'USER', avatar_path: null, avatar_url: null, sanmail_email: null, phone: null, created_at: now, updated_at: now }).select().single();
        if (inserted.error) {
          if (!isUniqueViolation(inserted.error)) throw new Error(`Failed to create GTA World character ${externalCharacterId}: ${inserted.error.message}`);
          profile = await findProfile();
          if (!profile || profile.user_id !== user.id) throw new Error(`GTA World character identity collision for external ID ${externalCharacterId}.`);
          const recovered = await client.from('character_profiles').update({ full_name: fullName, updated_at: now }).eq('id', profile.id).eq('user_id', user.id).select().single();
          if (recovered.error || !recovered.data) throw new Error(`Failed to recover GTA World character ${externalCharacterId}: ${recovered.error?.message}`);
        }
      }
    }

    const allProfiles = await client.from('character_profiles').select('*').eq('user_id', user.id);
    if (allProfiles.error) throw new Error(`Failed to load synchronized characters: ${allProfiles.error.message}`);
    return { user, profiles: (allProfiles.data || []) as CharacterProfile[] };
  }

  let user = db.users.find((candidate) => candidate.provider === 'GTAWORLD' && candidate.external_user_id === externalUserId);
  if (!user) {
    user = { id: randomUUID(), provider: 'GTAWORLD', external_user_id: externalUserId, role: 'USER', status: 'ACTIVE', created_at: now, updated_at: now };
    db.users.push(user);
  }

  for (const character of Array.isArray(gtawUser.character) ? gtawUser.character : []) {
    const externalCharacterId = String(character.id);
    const fullName = `${character.firstname.trim()} ${character.lastname.trim()}`.trim();
    let profile = db.profiles.find((candidate) => candidate.external_character_id === externalCharacterId);
    if (profile && profile.user_id !== user.id) throw new Error(`GTA World character identity collision for external ID ${externalCharacterId}.`);
    if (profile) {
      profile.full_name = fullName;
      profile.updated_at = now;
    } else {
      profile = { id: randomUUID(), user_id: user.id, external_character_id: externalCharacterId, full_name: fullName, role: 'USER', avatar_path: '', avatar_url: '', sanmail_email: '', phone: '', created_at: now, updated_at: now };
      db.profiles.push(profile);
    }
  }

  return { user, profiles: db.profiles.filter((profile) => profile.user_id === user!.id) };
}
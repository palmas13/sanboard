import { CharacterProfile, User } from '@/types';
import { GtaWorldApiUser } from '@/lib/integrations/gtaworld/types';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';

export interface SyncGtaWorldResult {
  user: User;
  profiles: CharacterProfile[];
}

/**
 * Idempotently synchronizes a GTA World account and its characters with Supabase / memory store.
 * 
 * Rules:
 * 1. GTA World owns external IDs and canonical full names.
 * 2. Sanboard owns avatar_path, phone, sanmail_email, corporate relations, listings, and favorites.
 * 3. Never overwrite avatar_path or other Sanboard-managed fields for existing profiles.
 * 4. Never grant ADMIN role based on GTA World role data; preserve local Sanboard role.
 * 5. Non-destructive: never delete existing Sanboard profiles if absent from current GTAW payload.
 * 6. Completely isolated from payments: ZERO payment calls or credit operations.
 */
export async function syncGtaWorldAccountAndCharacters(
  gtawUser: GtaWorldApiUser
): Promise<SyncGtaWorldResult> {
  const externalUserId = String(gtawUser.id);
  const now = new Date().toISOString();

  // --------------------------------------------------------------------------
  // 1. SUPABASE DATA STORE
  // --------------------------------------------------------------------------
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (!client) {
      throw new Error('Supabase admin client is not configured for GTA World sync.');
    }

    // A. Resolve or create Sanboard user
    let user: User | null = null;

    // Search by provider & external_user_id
    const { data: existingUser } = await client
      .from('users')
      .select('*')
      .eq('provider', 'GTAWORLD')
      .eq('external_user_id', externalUserId)
      .maybeSingle();

    if (existingUser) {
      user = existingUser as User;
    } else {
      // Create new Sanboard user. Role is strictly 'USER' (GTAW role cannot grant ADMIN).
      const { data: newUser, error: createErr } = await client
        .from('users')
        .insert({
          provider: 'GTAWORLD',
          external_user_id: externalUserId,
          role: 'USER',
          status: 'ACTIVE',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (createErr || !newUser) {
        throw new Error(`Failed to create Sanboard user for GTA World ID ${externalUserId}: ${createErr?.message}`);
      }
      user = newUser as User;
    }

    // B. Synchronize characters
    const syncedProfiles: CharacterProfile[] = [];
    const characters = Array.isArray(gtawUser.character) ? gtawUser.character : [];

    for (const char of characters) {
      const extCharId = String(char.id);
      const canonicalName = `${char.firstname.trim()} ${char.lastname.trim()}`;

      // Check if profile exists by external_character_id or matching name for this user
      const { data: existingProfile } = await client
        .from('character_profiles')
        .select('*')
        .or(`external_character_id.eq.${extCharId},and(user_id.eq.${user.id},full_name.ilike.${canonicalName})`)
        .maybeSingle();

      if (existingProfile) {
        // Update name and external ID, strictly PRESERVE avatar_path, phone, sanmail_email, dealer_id
        const updatePayload: Record<string, any> = {
          full_name: canonicalName,
          external_character_id: extCharId,
          user_id: user.id, // ensure bound to current authenticated user
          updated_at: now,
        };

        const { data: updated, error: updateErr } = await client
          .from('character_profiles')
          .update(updatePayload)
          .eq('id', existingProfile.id)
          .select()
          .single();

        if (!updateErr && updated) {
          const profile = updated as CharacterProfile;
          if (!profile.avatar_path && profile.avatar_url) {
            profile.avatar_path = profile.avatar_url;
          }
          syncedProfiles.push(profile);
        } else {
          syncedProfiles.push(existingProfile as CharacterProfile);
        }
      } else {
        // Create new character profile
        const sanitizedFirst = char.firstname.toLowerCase().replace(/[^a-z0-9]/g, '');
        const sanitizedLast = char.lastname.toLowerCase().replace(/[^a-z0-9]/g, '');
        const defaultSanmail = `${sanitizedFirst}.${sanitizedLast}@sanmail.com`;
        const defaultPhone = `555-${Math.floor(1000 + Math.random() * 9000)}`;

        const { data: created, error: insertErr } = await client
          .from('character_profiles')
          .insert({
            user_id: user.id,
            external_character_id: extCharId,
            full_name: canonicalName,
            avatar_path: null,
            avatar_url: null,
            sanmail_email: defaultSanmail,
            phone: defaultPhone,
            is_dealer: false,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (!insertErr && created) {
          syncedProfiles.push(created as CharacterProfile);
        }
      }
    }

    // Also fetch any existing Sanboard profiles for this user not in current response (non-destructive)
    const { data: allProfiles } = await client
      .from('character_profiles')
      .select('*')
      .eq('user_id', user.id);

    const mergedMap = new Map<string, CharacterProfile>();
    for (const p of (allProfiles || []) as CharacterProfile[]) {
      if (!p.avatar_path && p.avatar_url) p.avatar_path = p.avatar_url;
      mergedMap.set(p.id, p);
    }
    for (const p of syncedProfiles) {
      mergedMap.set(p.id, p);
    }

    return {
      user,
      profiles: Array.from(mergedMap.values()),
    };
  }

  // --------------------------------------------------------------------------
  // 2. MEMORY DATA STORE (Fallback / Local Unit Tests)
  // --------------------------------------------------------------------------
  let user = db.users.find(
    (u) => u.provider === 'GTAWORLD' && u.external_user_id === externalUserId
  );

  if (!user) {
    user = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      provider: 'GTAWORLD',
      external_user_id: externalUserId,
      role: 'USER',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    };
    db.users.push(user);
  }

  const syncedProfiles: CharacterProfile[] = [];
  const characters = Array.isArray(gtawUser.character) ? gtawUser.character : [];

  for (const char of characters) {
    const extCharId = String(char.id);
    const canonicalName = `${char.firstname.trim()} ${char.lastname.trim()}`;

    let profile = db.profiles.find(
      (p) =>
        p.external_character_id === extCharId ||
        (p.user_id === user!.id && p.full_name.toLowerCase() === canonicalName.toLowerCase())
    );

    if (profile) {
      profile.full_name = canonicalName;
      profile.external_character_id = extCharId;
      profile.user_id = user.id;
      profile.updated_at = now;
      syncedProfiles.push(profile);
    } else {
      const sanitizedFirst = char.firstname.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sanitizedLast = char.lastname.toLowerCase().replace(/[^a-z0-9]/g, '');

      profile = {
        id: `char-${extCharId}`,
        user_id: user.id,
        external_character_id: extCharId,
        full_name: canonicalName,
        avatar_path: '',
        avatar_url: '',
        sanmail_email: `${sanitizedFirst}.${sanitizedLast}@sanmail.com`,
        phone: `555-${Math.floor(1000 + Math.random() * 9000)}`,
        created_at: now,
        updated_at: now,
      };
      db.profiles.push(profile);
      syncedProfiles.push(profile);
    }
  }

  // Include any other existing profiles owned by this user
  const allUserProfiles = db.profiles.filter((p) => p.user_id === user!.id);
  const finalMap = new Map<string, CharacterProfile>();
  for (const p of allUserProfiles) finalMap.set(p.id, p);
  for (const p of syncedProfiles) finalMap.set(p.id, p);

  return {
    user,
    profiles: Array.from(finalMap.values()),
  };
}

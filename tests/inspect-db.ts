import { getSupabaseAdminClient } from '../src/lib/db/supabase-client';

async function main() {
  const client = getSupabaseAdminClient();
  if (!client) {
    console.error('No admin client');
    process.exit(1);
  }

  const { data: profiles, error: pErr } = await client
    .from('character_profiles')
    .select('*');
  console.log('--- PROFILES ---');
  console.log(profiles);
  if (pErr) console.error('Profiles error:', pErr);

  const { data: users, error: uErr } = await client
    .from('users')
    .select('id, username, role');
  console.log('--- USERS ---');
  console.log(users);

  const { data: dealers, error: dErr } = await client
    .from('corporate_profiles')
    .select('id, company_name, public_id, owner_profile_id, logo_path, banner_path');
  console.log('--- CORPORATE PROFILES ---');
  console.log(dealers);

  const { data: favorites, error: fErr } = await client
    .from('favorites')
    .select('*');
  console.log('--- FAVORITES ---');
  console.log(favorites);

  const { data: apps, error: aErr } = await client
    .from('corporate_applications')
    .select('*');
  console.log('--- CORPORATE APPLICATIONS ---');
  console.log(apps);

  console.log('--- TESTING WORKER AVATAR FETCH ---');
  for (const p of (profiles || [])) {
    if (p.avatar_path) {
      const fullUrl = p.avatar_path.startsWith('http') ? p.avatar_path : `https://cdn.sanboard.xyz/${p.avatar_path}`;
      try {
        const res = await fetch(fullUrl);
        console.log(`Fetch ${p.name || p.full_name}:`, fullUrl, '-> Status:', res.status, res.statusText, 'Type:', res.headers.get('content-type'));
      } catch (err: any) {
        console.error(`Fetch ${p.name || p.full_name} failed:`, err.message);
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

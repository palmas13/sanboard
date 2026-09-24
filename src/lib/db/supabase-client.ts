import { createClient, SupabaseClient } from '@supabase/supabase-js';

let publicClientInstance: SupabaseClient | null = null;
let adminClientInstance: SupabaseClient | null = null;

/**
 * Checks whether Supabase URL and publishable key are provided in environment variables.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && publishableKey && url.startsWith('http') && !url.includes('placeholder'));
}

/**
 * Checks whether Supabase secret key is provided for backend administrative tasks.
 */
export function isSupabaseAdminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  return Boolean(url && secretKey && url.startsWith('http') && !secretKey.includes('placeholder'));
}

/**
 * Returns standard Supabase Client respecting RLS policies.
 * Returns null if Supabase environment variables are not configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!publicClientInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    publicClientInstance = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return publicClientInstance;
}

/**
 * Returns Supabase Admin Client using secret key.
 * Used exclusively for server-side webhooks, cron jobs and trusted system operations.
 * Returns null if credentials are not configured.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  if (!adminClientInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const secretKey = process.env.SUPABASE_SECRET_KEY!;
    adminClientInstance = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClientInstance;
}

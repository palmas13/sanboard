import { getSupabaseAdminClient } from '@/lib/db/supabase-client';

export type FaviconSetting = { url: string; storageKey: string; mimeType: string; sizeBytes: number; width: number; height: number; version: string };

export async function getFaviconSetting(): Promise<FaviconSetting | null> {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  const { data, error } = await client.from('site_settings').select('favicon_url,favicon_storage_key,favicon_mime_type,favicon_size_bytes,favicon_width,favicon_height,favicon_updated_at').eq('id', true).maybeSingle();
  if (error || !data?.favicon_url) return null;
  return { url: data.favicon_url, storageKey: data.favicon_storage_key, mimeType: data.favicon_mime_type, sizeBytes: data.favicon_size_bytes, width: data.favicon_width, height: data.favicon_height, version: data.favicon_updated_at };
}

export async function saveFaviconSetting(value: Omit<FaviconSetting, 'version'>, actorProfileId: string): Promise<FaviconSetting> {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Veritabanı yapılandırılmadı.');
  const version = new Date().toISOString();
  const { error } = await client.from('site_settings').upsert({ id: true, favicon_url: value.url, favicon_storage_key: value.storageKey, favicon_mime_type: value.mimeType, favicon_size_bytes: value.sizeBytes, favicon_width: value.width, favicon_height: value.height, favicon_updated_at: version, updated_by_profile_id: actorProfileId }, { onConflict: 'id' });
  if (error) throw new Error('Favicon ayarı kaydedilemedi.');
  return { ...value, version };
}
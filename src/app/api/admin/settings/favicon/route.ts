import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { resolveActiveAdmin } from '@/lib/auth/active-profile';
import { getFaviconSetting, saveFaviconSetting } from '@/lib/site-settings';
import { getStorageProvider, uploadSiteFavicon } from '@/lib/storage';
import { recordAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

const ALLOWED_FAVICON_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const MAX_FAVICON_BYTES = 1024 * 1024;

export function validateFaviconFile(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size) {
    return { status: 400, error: 'Favicon dosyası zorunludur.' } as const;
  }
  if (file.size > MAX_FAVICON_BYTES) {
    return { status: 413, error: 'Favicon en fazla 1 MB olabilir.' } as const;
  }
  if (!ALLOWED_FAVICON_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      status: 415,
      error: 'Yalnızca PNG, JPEG veya WEBP favicon yüklenebilir.',
    } as const;
  }
  return null;
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const actor = await resolveActiveAdmin(req);
  if (!actor.ok) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  return NextResponse.json(
    { favicon: await getFaviconSetting() },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const actor = await resolveActiveAdmin(req);
  if (!actor.ok) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 });
  }

  const type = req.headers.get('content-type') || '';
  if (!type.toLowerCase().startsWith('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data gereklidir.' }, { status: 415 });
  }

  try {
    const form = await req.formData();
    const file = form.get('favicon');
    const validationError = validateFaviconFile(file);
    if (validationError) {
      return NextResponse.json(
        { error: validationError.error },
        { status: validationError.status }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Favicon dosyası zorunludur.' }, { status: 400 });
    }

    const previous = await getFaviconSetting();
    const uploaded = await uploadSiteFavicon(Buffer.from(await file.arrayBuffer()));
    if (!uploaded.success) {
      return NextResponse.json(
        { error: uploaded.error || 'Favicon yüklenemedi.' },
        { status: 400 }
      );
    }

    try {
      const favicon = await saveFaviconSetting(
        {
          url: uploaded.url,
          storageKey: uploaded.key,
          mimeType: 'image/png',
          sizeBytes: uploaded.sizeBytes,
          width: 512,
          height: 512,
        },
        actor.profileId
      );
      if (previous?.storageKey && previous.storageKey !== uploaded.key) {
        await getStorageProvider().delete(previous.storageKey);
      }
      await recordAuditEvent({
        eventType: 'ADMIN_FAVICON_UPDATED',
        userId: actor.userId,
        profileId: actor.profileId,
        metadata: {
          targetType: 'site_setting',
          targetId: 'favicon',
          storageKey: uploaded.key,
        },
      });
      revalidatePath('/', 'layout');
      return NextResponse.json(
        { success: true, favicon },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    } catch (error) {
      await getStorageProvider().delete(uploaded.key);
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Favicon güncellenemedi.' }, { status: 500 });
  }
}
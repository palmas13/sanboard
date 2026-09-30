import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { uploadListingImage } from '@/lib/storage';
import { deleteMediaSafely } from '@/lib/storage/lifecycle';
import { extractObjectKey } from '@/lib/media/url';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  const actor = await resolveOwnedActiveProfile(req);
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Yüklenecek fotoğraf bulunamadı.' }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Yalnızca JPG, PNG veya WEBP fotoğraf yükleyebilirsiniz.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Her fotoğraf en fazla 2 MB olabilir.' }, { status: 413 });
    }

    const result = await uploadListingImage(Buffer.from(await file.arrayBuffer()), actor.profileId, file.type);
    if (!result.success || !result.key) {
      console.error('Listing image upload failed', {
        profileId: actor.profileId,
        fileSize: file.size,
        fileType: file.type,
        error: result.error,
      });
      return NextResponse.json({ error: result.error || 'Fotoğraf yüklenemedi.' }, { status: 500 });
    }

    return NextResponse.json({
      image: {
        storage_path: result.key,
        size_bytes: result.sizeBytes,
      },
    });
  } catch (error) {
    console.error('Listing image upload route failed', {
      profileId: actor.profileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Fotoğraf yüklenirken beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await resolveOwnedActiveProfile(req);
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

  try {
    const body = await req.json().catch(() => ({})) as { storage_path?: string };
    const objectKey = extractObjectKey(body.storage_path);
    if (!objectKey || !objectKey.startsWith(`listings/${actor.profileId}/`)) {
      return NextResponse.json({ error: 'Geçersiz fotoğraf referansı.' }, { status: 400 });
    }

    await deleteMediaSafely(objectKey, 'LISTING_IMAGE', 'LISTING_UPLOAD_ROLLBACK');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pending listing image cleanup failed', {
      profileId: actor.profileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Fotoğraf kaldırılamadı.' }, { status: 500 });
  }
}
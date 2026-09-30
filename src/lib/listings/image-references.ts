export interface ListingImageReference {
  storage_path: string;
  size_bytes: number;
  is_cover: boolean;
  sort_order: number;
}

export interface ListingImageInput extends ListingImageReference {
  id?: string;
  preview_url?: string;
  is_pending?: boolean;
}

export function isEmbeddedListingImage(path: string): boolean {
  const normalized = path.trim().toLowerCase();
  return normalized.startsWith('data:') || normalized.startsWith('blob:');
}

export function toListingImageReferences(images: ListingImageInput[]): ListingImageReference[] {
  return images.map((image, index) => {
    if (isEmbeddedListingImage(image.storage_path)) {
      throw new Error('Fotoğraflar yayınlanmadan önce yüklenmelidir. Lütfen görselleri yeniden seçin.');
    }

    return {
      storage_path: image.storage_path,
      size_bytes: image.size_bytes,
      is_cover: image.is_cover,
      sort_order: image.sort_order ?? index,
    };
  });
}

export function getJsonPayloadSizeBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
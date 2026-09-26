import { ListingImage } from '@/types';

export function sortListingImages(images?: ListingImage[] | null): ListingImage[] {
  return [...(images || [])]
    .filter((image) => Boolean(image?.storage_path?.trim()))
    .sort((left, right) => {
      if (left.is_cover !== right.is_cover) return left.is_cover ? -1 : 1;
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      const createdComparison = (left.created_at || '').localeCompare(right.created_at || '');
      if (createdComparison !== 0) return createdComparison;
      return left.id.localeCompare(right.id);
    });
}

export function getListingCoverPath(images?: ListingImage[] | null): string | undefined {
  return sortListingImages(images)[0]?.storage_path;
}
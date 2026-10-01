export type GalleryVariant = 'vehicle' | 'property';

export interface GalleryPreloadPlan {
  immediate: string[];
  deferred: string[];
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean))];
}

export function getGalleryPreloadPlan(
  urls: string[],
  currentIndex: number,
  variant: GalleryVariant,
  constrainedConnection = false,
): GalleryPreloadPlan {
  const imageUrls = uniqueUrls(urls);
  const currentUrl = urls[currentIndex];

  if (!currentUrl || imageUrls.length <= 1) {
    return { immediate: [], deferred: [] };
  }

  const previousUrl = urls[(currentIndex - 1 + urls.length) % urls.length];
  const nextUrl = urls[(currentIndex + 1) % urls.length];
  const adjacent = uniqueUrls([previousUrl, nextUrl]).filter((url) => url !== currentUrl);
  const remaining = imageUrls.filter((url) => url !== currentUrl && !adjacent.includes(url));

  if (variant === 'vehicle' && !constrainedConnection) {
    return { immediate: [...adjacent, ...remaining], deferred: [] };
  }

  return {
    immediate: adjacent,
    deferred: constrainedConnection ? [] : remaining,
  };
}
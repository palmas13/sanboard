import type { ListingCategory } from '@/types';

export const MAX_SIMILAR_LISTINGS = 10;

export interface SimilarityListing {
  id: string;
  category: ListingCategory;
  subcategory: string;
  price: number | string | bigint;
  published_at?: string | null;
  created_at?: string | null;
  brand?: string | null;
  model?: string | null;
}

export interface RankedSimilarListing<T extends SimilarityListing> {
  listing: T;
  score: number;
  priceDistance: bigint;
}

function normalizeText(value?: string | null): string {
  return value?.trim().toLocaleLowerCase('tr-TR') || '';
}

export function toPriceBigInt(value: number | string | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return BigInt(0);
    return BigInt(Math.trunc(value));
  }
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

export function clampSimilarListingsLimit(limit: number): number {
  if (!Number.isFinite(limit)) return MAX_SIMILAR_LISTINGS;
  return Math.min(MAX_SIMILAR_LISTINGS, Math.max(0, Math.trunc(limit)));
}

function getPriceProximityScore(currentPrice: bigint, candidatePrice: bigint): number {
  const base = currentPrice > BigInt(0) ? currentPrice : BigInt(1);
  const distance = candidatePrice >= currentPrice
    ? candidatePrice - currentPrice
    : currentPrice - candidatePrice;
  const basisPoints = (distance * BigInt(10_000)) / base;
  const cappedBasisPoints = basisPoints > BigInt(10_000) ? BigInt(10_000) : basisPoints;

  // A continuous score keeps actual price distance meaningful instead of placing
  // every candidate in a small number of coarse price buckets.
  return Number((BigInt(10_000) - cappedBasisPoints) * BigInt(300) / BigInt(10_000));
}

export function rankSimilarListings<T extends SimilarityListing>(
  current: SimilarityListing,
  candidates: T[],
  limit = MAX_SIMILAR_LISTINGS
): T[] {
  const boundedLimit = clampSimilarListingsLimit(limit);
  if (boundedLimit === 0) return [];

  const currentPrice = toPriceBigInt(current.price);
  const currentBrand = normalizeText(current.brand);
  const currentModel = normalizeText(current.model);

  const ranked: RankedSimilarListing<T>[] = candidates
    .filter((candidate) => (
      candidate.id !== current.id &&
      candidate.category === current.category &&
      candidate.subcategory === current.subcategory
    ))
    .map((candidate) => {
      const candidatePrice = toPriceBigInt(candidate.price);
      const candidateBrand = normalizeText(candidate.brand);
      const candidateModel = normalizeText(candidate.model);
      const sameModel = Boolean(currentModel && candidateModel === currentModel);
      const sameBrand = Boolean(currentBrand && candidateBrand === currentBrand);
      const priceDistance = candidatePrice >= currentPrice
        ? candidatePrice - currentPrice
        : currentPrice - candidatePrice;

      return {
        listing: candidate,
        score:
          (sameModel ? 160 : 0) +
          (sameBrand ? 100 : 0) +
          getPriceProximityScore(currentPrice, candidatePrice),
        priceDistance,
      };
    });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.priceDistance !== b.priceDistance) return a.priceDistance < b.priceDistance ? -1 : 1;

    const parsedADate = new Date(a.listing.published_at || a.listing.created_at || 0).getTime();
    const parsedBDate = new Date(b.listing.published_at || b.listing.created_at || 0).getTime();
    const aDate = Number.isFinite(parsedADate) ? parsedADate : 0;
    const bDate = Number.isFinite(parsedBDate) ? parsedBDate : 0;
    if (bDate !== aDate) return bDate - aDate;

    return a.listing.id.localeCompare(b.listing.id);
  });

  return ranked.slice(0, boundedLimit).map(({ listing }) => listing);
}
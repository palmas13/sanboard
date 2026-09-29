'use client';
import { Handshake } from 'lucide-react';
import { useOfferCenter } from './OfferCenter';

export function OfferButton({ listing, className = '' }: { listing: { id: string; title: string; price: number; minimum_offer_amount?: number | null; images?: Array<{ storage_path: string }> }; className?: string }) {
  const { openForListing } = useOfferCenter();
  return <button type="button" aria-haspopup="dialog" onClick={() => openForListing({ listingId: listing.id, title: listing.title, price: listing.price, minimum: listing.minimum_offer_amount, thumbnail: listing.images?.[0]?.storage_path })} className={`btn-primary inline-flex items-center gap-2 ${className}`}><Handshake className="h-4 w-4" />Teklif Ver</button>;
}
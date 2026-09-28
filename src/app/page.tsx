import { getDealerRepository, getListingRepository } from '@/lib/db/repositories';
import { HeroShowcase } from '@/components/home/HeroShowcase';
import { HomepageMarketplace } from '@/components/home/HomepageMarketplace';
import { WhySanboardSection } from '@/components/home/WhySanboardSection';

export const revalidate = 30;

export default async function HomePage() {
  const listingRepo = getListingRepository();
  const dealerRepo = getDealerRepository();
  const [allListings, allDealers] = await Promise.all([
    listingRepo.getPublicListings({ sort: 'newest' }),
    dealerRepo.getAllDealers?.() ?? Promise.resolve([]),
  ]);

  const now = Date.now();
  const featuredListings = allListings.filter((listing) => listing.is_featured && (!listing.featured_until || new Date(listing.featured_until).getTime() > now));
  const vehicleListings = allListings.filter((listing) => listing.category === 'vehicle');
  const propertyListings = allListings.filter((listing) => listing.category === 'property');
  const corporateSellers = allDealers.filter((dealer) => dealer.status === 'APPROVED' && dealer.moderation_status !== 'SUSPENDED' && dealer.moderation_status !== 'DELETED' && !dealer.deleted_at).slice(0, 5);
  const corporateListingCounts = allListings.reduce<Record<string, number>>((counts, listing) => {
    if (listing.corporate_profile_id) counts[listing.corporate_profile_id] = (counts[listing.corporate_profile_id] || 0) + 1;
    return counts;
  }, {});

  return (
    <div className="homepage-shell pb-8 sm:pb-12">
      <HeroShowcase />
      <HomepageMarketplace featuredListings={featuredListings} vehicleListings={vehicleListings} propertyListings={propertyListings} corporateSellers={corporateSellers} corporateListingCounts={corporateListingCounts} />
      <WhySanboardSection />
    </div>
  );
}

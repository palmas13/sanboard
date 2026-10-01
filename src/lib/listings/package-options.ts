import type { CorporateEligibilityResult } from '@/lib/dealers/eligibility';
import type { CharacterProfile } from '@/types';

export interface ListingPackageOptions {
  profile: Pick<CharacterProfile, 'id' | 'full_name' | 'avatar_url' | 'avatar_path'>;
  individual: {
    availableCredits: number;
    action: 'BUY' | 'USE';
  };
  corporate: null | {
    dealer: NonNullable<CorporateEligibilityResult['dealer']>;
    availableCredits: number;
    action: 'BUY' | 'USE';
  };
  testPublishBypass: boolean;
}

export function buildListingPackageOptions(input: {
  profile: CharacterProfile;
  eligibility: CorporateEligibilityResult;
  credits: Array<{
    status?: string;
    credit_type?: string | null;
    corporate_profile_id?: string | null;
  }>;
  testPublishBypass?: boolean;
}): ListingPackageOptions {
  const availableCredits = input.credits.filter((credit) => credit.status === 'AVAILABLE');
  const individualCredits = availableCredits.filter(
    (credit) => credit.credit_type === 'INDIVIDUAL' || !credit.credit_type
  ).length;
  const dealer = input.eligibility.eligible ? input.eligibility.dealer : null;
  const corporateCredits = dealer
    ? availableCredits.filter(
        (credit) => credit.credit_type === 'CORPORATE' && credit.corporate_profile_id === dealer.id
      ).length
    : 0;

  return {
    profile: {
      id: input.profile.id,
      full_name: input.profile.full_name,
      avatar_url: input.profile.avatar_url,
      avatar_path: input.profile.avatar_path,
    },
    individual: {
      availableCredits: individualCredits,
      action: individualCredits > 0 || input.testPublishBypass ? 'USE' : 'BUY',
    },
    corporate: dealer
      ? {
          dealer,
          availableCredits: corporateCredits,
          action: corporateCredits > 0 || input.testPublishBypass ? 'USE' : 'BUY',
        }
      : null,
    testPublishBypass: input.testPublishBypass === true,
  };
}
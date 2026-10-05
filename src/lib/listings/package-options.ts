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

export type ListingPackagePageState =
  | { status: 'LOADING' }
  | { status: 'ERROR'; message: string }
  | {
      status: 'READY';
      layout: 'SINGLE_OPTION' | 'MULTI_OPTION';
      options: ListingPackageOptions;
    };

export function resolveListingPackagePageState(input: {
  loading: boolean;
  error?: string;
  options: ListingPackageOptions | null;
}): ListingPackagePageState {
  if (input.loading) return { status: 'LOADING' };
  if (input.error || !input.options) {
    return {
      status: 'ERROR',
      message: input.error || 'İlan hakların yüklenirken bir sorun oluştu.',
    };
  }

  return {
    status: 'READY',
    layout: input.options.corporate ? 'MULTI_OPTION' : 'SINGLE_OPTION',
    options: input.options,
  };
}

export function buildListingPackageOptions(input: {
  profile: CharacterProfile;
  eligibility: CorporateEligibilityResult;
  credits: Array<{
    status?: string;
    used_at?: string | null;
    credit_type?: string | null;
    corporate_profile_id?: string | null;
  }>;
  testPublishBypass?: boolean;
}): ListingPackageOptions {
  const availableCredits = input.credits.filter((credit) => credit.status === 'AVAILABLE' && credit.used_at == null);
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
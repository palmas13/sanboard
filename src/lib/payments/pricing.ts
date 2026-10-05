export const PAYMENT_PURPOSES = ['LISTING_PUBLICATION', 'LISTING_BOOST', 'CORPORATE_SUBSCRIPTION'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_PACKAGE_CODES = [
  'STANDARD_7_DAY',
  'CORPORATE_14_DAY',
  'CORPORATE_SUBSCRIPTION_30_DAY',
  'CORPORATE_PLUS_30_DAY',
  'LISTING_BOOST_24_HOUR',
] as const;
export type PaymentPackageCode = (typeof PAYMENT_PACKAGE_CODES)[number];

export const CANONICAL_PRICING: Record<PaymentPackageCode, number> = {
  STANDARD_7_DAY: 1500,
  CORPORATE_14_DAY: 1250,
  CORPORATE_SUBSCRIPTION_30_DAY: 5500,
  CORPORATE_PLUS_30_DAY: 25000,
  LISTING_BOOST_24_HOUR: 1000,
};

export const PAYMENT_DESCRIPTIONS: Record<PaymentPackageCode, string> = {
  STANDARD_7_DAY: 'Sanboard Bireysel İlan Hakkı',
  CORPORATE_14_DAY: 'Sanboard Kurumsal İlan Hakkı',
  CORPORATE_SUBSCRIPTION_30_DAY: 'Sanboard Kurumsal Standard Üyelik',
  CORPORATE_PLUS_30_DAY: 'Sanboard Kurumsal Plus Üyelik',
  LISTING_BOOST_24_HOUR: 'Sanboard Boost Kredisi',
};

export function isPaymentPackageCode(value: unknown): value is PaymentPackageCode {
  return typeof value === 'string' && PAYMENT_PACKAGE_CODES.includes(value as PaymentPackageCode);
}

export function getPackagePrice(packageCode: PaymentPackageCode, quantity = 1): number {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Geçersiz ödeme adedi.');
  return CANONICAL_PRICING[packageCode] * quantity;
}

export function getPaymentDescription(packageCode: PaymentPackageCode, quantity = 1): string {
  const label = PAYMENT_DESCRIPTIONS[packageCode];
  return packageCode === 'LISTING_BOOST_24_HOUR' && quantity > 1 ? `${label} x${quantity}` : label;
}

export function getPaymentPrice(purpose: PaymentPurpose, packageCode?: PaymentPackageCode): number {
  if (packageCode) return getPackagePrice(packageCode);
  if (purpose === 'LISTING_BOOST') return CANONICAL_PRICING.LISTING_BOOST_24_HOUR;
  if (purpose === 'CORPORATE_SUBSCRIPTION') return CANONICAL_PRICING.CORPORATE_SUBSCRIPTION_30_DAY;
  return CANONICAL_PRICING.STANDARD_7_DAY;
}

export function isPaymentPurpose(value: unknown): value is PaymentPurpose {
  return typeof value === 'string' && PAYMENT_PURPOSES.includes(value as PaymentPurpose);
}
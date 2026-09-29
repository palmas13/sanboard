export const PAYMENT_PURPOSES = ['LISTING_PUBLICATION', 'LISTING_BOOST', 'CORPORATE_SUBSCRIPTION'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

const PRICES: Record<PaymentPurpose, number> = {
  LISTING_PUBLICATION: 1,
  LISTING_BOOST: 1,
  CORPORATE_SUBSCRIPTION: 1,
};

export function getPaymentPrice(purpose: PaymentPurpose): number {
  return PRICES[purpose];
}

export function isPaymentPurpose(value: unknown): value is PaymentPurpose {
  return typeof value === 'string' && PAYMENT_PURPOSES.includes(value as PaymentPurpose);
}
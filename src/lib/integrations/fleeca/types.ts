export interface CreateCheckoutParams {
  orderId: string;
  profileId: string;
  characterName: string;
  packageCode: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface FleecaOrder {
  orderId: string;
  profileId: string;
  characterName: string;
  packageCode: string;
  packageName: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  paymentId?: string;
  paymentLink?: string;
}

export interface FleecaPaymentDetailsResponse {
  success: true;
  data: {
    payment_id: string;
    merchant_id: number;
    amount: number;
    description: string;
    status: string;
    mode: 'sandbox' | 'live';
    payer_routing: unknown | null;
    payer_name: string | null;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
  };
}

export type ExternalPaymentStatus = 'VERIFIED' | 'PENDING' | 'FAILED';

export interface VerifiedExternalPayment {
  externalTransactionId: string;
  status: ExternalPaymentStatus;
  orderReference: string;
  payerReference: string;
  amount: number;
  currency: string;
  purposeReference: string;
  occurredAt: string;
}

export interface PaymentVerificationExpectation {
  orderReference: string;
  payerReference: string;
  amount: number;
  currency: string;
  purposeReference: string;
}

export type PaymentVerificationFailure =
  | 'PENDING'
  | 'FAILED'
  | 'WRONG_ORDER'
  | 'WRONG_AMOUNT'
  | 'WRONG_PAYER'
  | 'WRONG_CURRENCY'
  | 'WRONG_PURPOSE';

export type PaymentVerificationDecision =
  | { verified: true; transaction: VerifiedExternalPayment }
  | { verified: false; reason: PaymentVerificationFailure };

export function validateExternalPayment(
  transaction: VerifiedExternalPayment,
  expected: PaymentVerificationExpectation
): PaymentVerificationDecision {
  if (transaction.status === 'PENDING') return { verified: false, reason: 'PENDING' };
  if (transaction.status === 'FAILED') return { verified: false, reason: 'FAILED' };
  if (transaction.orderReference !== expected.orderReference) return { verified: false, reason: 'WRONG_ORDER' };
  if (transaction.amount !== expected.amount) return { verified: false, reason: 'WRONG_AMOUNT' };
  if (transaction.payerReference !== expected.payerReference) return { verified: false, reason: 'WRONG_PAYER' };
  if (transaction.currency !== expected.currency) return { verified: false, reason: 'WRONG_CURRENCY' };
  if (transaction.purposeReference !== expected.purposeReference) return { verified: false, reason: 'WRONG_PURPOSE' };
  return { verified: true, transaction };
}

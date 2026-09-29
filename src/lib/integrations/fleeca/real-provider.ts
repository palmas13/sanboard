import { z } from 'zod';
import { FleecaPaymentProvider } from './provider';
import { CreateCheckoutParams, FleecaOrder, VerifiedExternalPayment } from './types';
import { FLEECA_API_BASE_URL, getFleecaApiKey, getFleecaMode } from './config';

export const FLEECA_PROVIDER_NOT_CONFIGURED = 'FLEECA_PROVIDER_NOT_CONFIGURED';

export class FleecaProviderNotConfiguredError extends Error {
  readonly code = FLEECA_PROVIDER_NOT_CONFIGURED;

  constructor() {
    super('Fleeca ödeme sağlayıcısı yapılandırılmadı.');
    this.name = 'FleecaProviderNotConfiguredError';
  }
}

const createSchema = z.object({
  success: z.literal(true), payment_id: z.uuid(),
  payment_link: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'banking-tr.gta.world' && url.pathname.startsWith('/gateway/');
  }),
  message: z.string(),
}).strict();

const detailsSchema = z.object({
  success: z.literal(true),
  data: z.object({
    payment_id: z.uuid(), merchant_id: z.number().int(), amount: z.number().int().positive(),
    description: z.string(), status: z.string(), mode: z.enum(['sandbox', 'live']),
    payer_routing: z.unknown().nullable(), payer_name: z.string().nullable(), paid_at: z.string().nullable(),
    created_at: z.string(), updated_at: z.string(),
  }).strict(),
}).strict();

async function fleecaFetch(path: string, init: RequestInit): Promise<Response> {
  let key: string;
  try { key = getFleecaApiKey(); } catch { throw new FleecaProviderNotConfiguredError(); }
  return fetch(`${FLEECA_API_BASE_URL}${path}`, {
    ...init, cache: 'no-store', headers: {
      Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...init.headers,
    },
  });
}

export class RealFleecaPaymentProvider implements FleecaPaymentProvider {
  async createOrder(params: CreateCheckoutParams): Promise<FleecaOrder> {
    const response = await fleecaFetch('/v2/payment', {
      method: 'POST',
      body: JSON.stringify({ amount: params.amount, mode: getFleecaMode(), description: params.description || params.packageCode }),
    });
    const raw = await response.json().catch(() => null);
    if (response.status !== 201) throw new Error('Fleeca hosted payment oluşturulamadı.');
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Fleeca create-payment response doğrulanamadı.');
    return {
      orderId: params.orderId, profileId: params.profileId, characterName: params.characterName,
      packageCode: params.packageCode, packageName: params.packageCode, amount: params.amount,
      currency: params.currency, status: 'PENDING', createdAt: new Date().toISOString(),
      paymentId: parsed.data.payment_id, paymentLink: parsed.data.payment_link,
    };
  }

  async getOrder(paymentId: string): Promise<FleecaOrder | null> {
    const details = await this.getPaymentDetails(paymentId);
    const status = mapFleecaPaymentStatus(details.data.status);
    if (!status) throw new Error('Fleeca ödeme durumu tanınmıyor.');
    return {
      orderId: details.data.description, profileId: '', characterName: '', packageCode: details.data.description,
      packageName: details.data.description, amount: details.data.amount, currency: 'USD',
      status: status === 'VERIFIED' ? 'SUCCESS' : status === 'PENDING' ? 'PENDING' : 'FAILED',
      createdAt: details.data.created_at, paymentId: details.data.payment_id,
    };
  }

  async getPaymentDetails(paymentId: string) {
    const response = await fleecaFetch(`/v2/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });
    if (!response.ok) throw new Error('Fleeca ödeme durumu alınamadı.');
    const parsed = detailsSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new Error('Fleeca payment-details response doğrulanamadı.');
    return parsed.data;
  }

  async verifyPayment(paymentId: string): Promise<VerifiedExternalPayment> {
    const details = await this.getPaymentDetails(paymentId);
    const successful = details.data.status === 'payment_successful' && Boolean(details.data.paid_at);
    const status = successful ? 'VERIFIED' : mapFleecaPaymentStatus(details.data.status);
    if (!status || status === 'VERIFIED') throw new Error('Fleeca ödeme durumu doğrulanamadı.');
    return {
      externalTransactionId: details.data.payment_id,
      status,
      orderReference: '', payerReference: '', amount: details.data.amount, currency: 'USD',
      purposeReference: details.data.description, occurredAt: details.data.paid_at || details.data.updated_at,
    };
  }
}

export function mapFleecaPaymentStatus(status: string): VerifiedExternalPayment['status'] | null {
  if (status === 'payment_successful') return 'VERIFIED';
  if (status === 'awaiting_payment') return 'PENDING';
  if (status === 'payment_failed') return 'FAILED';
  return null;
}

export function parseFleecaCreateResponse(raw: unknown, status: number) {
  if (status !== 201) return null;
  const parsed = createSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseFleecaPaymentDetails(raw: unknown) {
  const parsed = detailsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

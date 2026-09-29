import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { getPaymentRepository } from '@/lib/db/repositories';
import { getFleecaApiKey } from '@/lib/integrations/fleeca/config';
import { verifyAndFulfillPayment } from '@/lib/payments/verification';

const callbackSchema = z.object({
  payment_id: z.uuid(),
  payment_url: z.url().optional(),
  mode: z.enum(['live', 'sandbox']).optional(),
  amount: z.number().positive(),
  payer_routing: z.string().nullable().optional(),
  payer_name: z.string().nullable().optional(),
  status: z.enum(['payment_successful', 'payment_failed', 'pending']),
  description: z.string().optional(),
  created_at: z.string().optional(),
  paid_at: z.string().nullable().optional(),
  status_reason: z.string().trim().max(500).optional(),
}).strip();

export function isValidFleecaSignature(rawBody: string, signature: string | null, apiKey: string): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = `sha256=${createHmac('sha256', apiKey).update(rawBody, 'utf8').digest('hex')}`;
  const providedBuffer = Buffer.from(signature.toLowerCase(), 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(req: NextRequest) {
  let apiKey: string;
  try {
    apiKey = getFleecaApiKey();
  } catch {
    return NextResponse.json({ received: false, error: 'Webhook yapılandırılmadı.' }, { status: 503 });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 64 * 1024) {
    return NextResponse.json({ received: false, error: 'Webhook payloadı çok büyük.' }, { status: 413 });
  }
  if (!isValidFleecaSignature(rawBody, req.headers.get('x-fleeca-signature'), apiKey)) {
    return NextResponse.json({ received: false, error: 'Geçersiz webhook imzası.' }, { status: 403 });
  }

  const parsedJson = (() => {
    try { return JSON.parse(rawBody); } catch { return null; }
  })();
  const parsed = callbackSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ received: false, error: 'Geçersiz webhook payloadı.' }, { status: 400 });
  }

  try {
    const payload = parsed.data;
    const repo = getPaymentRepository();
    const payment = await repo.getPaymentByExternalPaymentId(payload.payment_id);
    if (!payment || payment.external_payment_id !== payload.payment_id) {
      return NextResponse.json({ received: true, processed: false, state: 'NOT_FOUND' }, { status: 404 });
    }
    if (payment.amount !== payload.amount) {
      return NextResponse.json({ received: true, processed: false, state: 'UNVERIFIED' }, { status: 409 });
    }

    let state: 'PENDING' | 'FAILED' | 'SUCCESS' | 'UNVERIFIED';
    if (payload.status === 'pending') {
      state = 'PENDING';
    } else if (payload.status === 'payment_failed') {
      const failed = await repo.failPayment(payment.order_id, payload.payment_id);
      state = failed.success ? 'FAILED' : 'UNVERIFIED';
    } else {
      state = (await verifyAndFulfillPayment(payment)).state;
    }

    await recordAuditEvent({
      eventType: 'FLEECA_WEBHOOK_STATUS',
      profileId: payment.profile_id,
      metadata: {
        paymentId: payment.id,
        externalPaymentId: payload.payment_id,
        status: payload.status,
        state,
        statusReason: payload.status_reason || null,
        mode: payload.mode || null,
      },
    });

    return NextResponse.json({ received: true, processed: state === 'SUCCESS' || state === 'FAILED', state });
  } catch {
    return NextResponse.json({ received: true, processed: false, state: 'UNVERIFIED' }, { status: 500 });
  }
}
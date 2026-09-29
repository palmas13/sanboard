import type { NextRequest, NextResponse } from 'next/server';

export const PAYMENT_CORRELATION_COOKIE = 'sanboard_payment_order';

export function setPaymentCorrelationCookie(response: NextResponse, orderId: string): void {
  response.cookies.set(PAYMENT_CORRELATION_COOKIE, orderId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });
}

export function getPaymentCorrelation(req: NextRequest): string | null {
  return req.cookies.get(PAYMENT_CORRELATION_COOKIE)?.value || null;
}
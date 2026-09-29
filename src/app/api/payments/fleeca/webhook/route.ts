import { NextResponse } from 'next/server';

// Fleeca callback signature/payload contract is not yet authoritative.
// Never fulfill payments from this route until that contract is verified.
export async function POST() {
  return NextResponse.json({ received: true, processed: false });
}
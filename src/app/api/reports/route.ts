import { NextRequest, NextResponse } from 'next/server';
import { reportListing } from '@/lib/db/listings';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import type { ReportReason } from '@/types';

const REPORT_REASONS: ReportReason[] = ['Yanlış bilgi', 'Uygunsuz içerik', 'Şüpheli ilan', 'Diğer'];

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { listingId, reason, description } = await req.json();

    if (typeof listingId !== 'string' || !listingId.trim() || !REPORT_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: 'Geçerli ilan ve şikayet nedeni zorunludur.' },
        { status: 400 }
      );
    }
    if (typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'Şikayet açıklaması zorunludur.' }, { status: 400 });
    }

    const result = await reportListing(
      actor.profileId,
      listingId.trim(),
      reason,
      description.trim()
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Şikayet kaydedilemedi.' }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Şikayet kaydedilemedi.' },
      { status: 500 }
    );
  }
}

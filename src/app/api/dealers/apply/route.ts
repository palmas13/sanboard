import { NextRequest, NextResponse } from 'next/server';
import { getDealerRepository } from '@/lib/db/repositories';

import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const body = await req.json();
    const companyName = (body.companyName || body.company_name || '').trim();
    const purpose = (body.purpose || body.applicationPurpose || body.business_purpose || '').trim();

    if (!companyName || !purpose) {
      return NextResponse.json(
        { error: 'Şirket adı ve başvuru amacı alanları zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getDealerRepository();
    const result = await repo.createApplication({
      profileId: actor.profileId,
      companyName,
      purpose,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Başvuru iletilemedi.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const repo = getDealerRepository();
    if (typeof repo.getApplicationByProfileId === 'function') {
      const app = await repo.getApplicationByProfileId(actor.profileId);
      return NextResponse.json({ success: true, application: app });
    }

    return NextResponse.json({ success: true, application: null });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Başvuru sorgulanamadı.' },
      { status: 500 }
    );
  }
}

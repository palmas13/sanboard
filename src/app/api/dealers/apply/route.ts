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
    const contactPhone = String(body.contactPhone || body.contact_phone || '').trim();
    const contactEmail = String(body.contactEmail || body.contact_email || '').trim();
    const location = String(body.location || '').trim();

    if (!companyName || !contactPhone || !contactEmail || !location || purpose.length < 40 || purpose.length > 1000) {
      return NextResponse.json(
        { error: 'İşletme adı, iletişim, konum ve 40–1000 karakter faaliyet amacı zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getDealerRepository();
    const result = await repo.createApplication({
      profileId: actor.profileId,
      companyName,
      contactPhone,
      contactEmail,
      location,
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

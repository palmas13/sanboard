import { NextRequest, NextResponse } from 'next/server';
import { getDealerRepository } from '@/lib/db/repositories';

export async function POST(req: NextRequest) {
  try {
    const { profileId, companyName, purpose } = await req.json();

    if (!profileId || !companyName || !purpose) {
      return NextResponse.json(
        { error: 'Şirket adı ve başvuru amacı alanları zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getDealerRepository();
    const result = await repo.createApplication({
      profileId,
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

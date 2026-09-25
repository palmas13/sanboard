import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { resolveCorporateEligibility } from '@/lib/dealers/eligibility';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    const { searchParams } = new URL(req.url);
    const queryProfileId = searchParams.get('profileId');
    const cookieProfileId = req.cookies.get('sanboard_profile_id')?.value;
    const activeProfileId = session?.profileId || queryProfileId || cookieProfileId;

    if (!activeProfileId) {
      return NextResponse.json(
        { eligible: false, reason: 'NO_STORE', message: 'Oturum açmış karakter bulunamadı.' },
        { status: 401 }
      );
    }

    const result = await resolveCorporateEligibility(activeProfileId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { eligible: false, reason: 'NO_STORE', error: error?.message || 'Uygunluk kontrolü yapılamadı.' },
      { status: 500 }
    );
  }
}

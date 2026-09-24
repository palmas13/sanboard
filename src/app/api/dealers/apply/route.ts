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

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get('profileId');
    if (!profileId) {
      return NextResponse.json({ error: 'profileId zorunludur' }, { status: 400 });
    }

    if (process.env.DATA_STORE === 'supabase') {
      const { getSupabaseAdminClient } = await import('@/lib/db/supabase-client');
      const client = getSupabaseAdminClient();
      if (client) {
        const { data: profile } = await client
          .from('character_profiles')
          .select('id, external_character_id')
          .or(`id.eq.${profileId},external_character_id.eq.${profileId}`)
          .maybeSingle();

        const pId = profile?.id || profileId;
        const { data: app, error } = await client
          .from('corporate_applications')
          .select('*')
          .eq('applicant_profile_id', pId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          return NextResponse.json({ success: true, application: null });
        }
        return NextResponse.json({ success: true, application: app || null });
      }
    }

    return NextResponse.json({ success: true, application: null });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Başvuru sorgulanamadı.' },
      { status: 500 }
    );
  }
}

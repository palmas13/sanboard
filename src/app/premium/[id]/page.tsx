import { notFound, permanentRedirect } from 'next/navigation';
import { getDealerRepository } from '@/lib/db/repositories';
import { isUuid } from '@/lib/db/id-mapper';
import { getCorporateUrl } from '@/lib/urls';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PremiumLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const repo = getDealerRepository();
  let dealer = /^\d+$/.test(id) ? await repo.getDealerByPublicId?.(Number(id)) : null;
  if (!dealer && isUuid(id)) dealer = await repo.getDealerById(id);
  if (!dealer) dealer = await repo.getDealerByProfileId(id);
  if (!dealer) dealer = await repo.getDealerBySlug(id);
  if (!dealer) notFound();
  permanentRedirect(getCorporateUrl(dealer));
}
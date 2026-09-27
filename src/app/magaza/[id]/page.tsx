import { notFound, permanentRedirect } from 'next/navigation';
import { getDealerRepository } from '@/lib/db/repositories';
import { isUuid } from '@/lib/db/id-mapper';
import { getCorporateUrl } from '@/lib/urls';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MagazaRedirectPage({ params }: PageProps) {
  const { id } = await params;
  const dealerRepo = getDealerRepository();
  let dealer = /^\d+$/.test(id) ? await dealerRepo.getDealerByPublicId?.(Number(id)) : null;

  if (!dealer && isUuid(id)) {
    dealer = await dealerRepo.getDealerById(id);
  }

  if (!dealer) {
    dealer = await dealerRepo.getDealerByProfileId(id);
  }
  if (!dealer) {
    dealer = await dealerRepo.getDealerBySlug(id);
  }

  if (!dealer) notFound();
  permanentRedirect(getCorporateUrl(dealer));
}

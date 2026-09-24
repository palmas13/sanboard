import { redirect } from 'next/navigation';
import { getDealerRepository } from '@/lib/db/repositories';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MagazaRedirectPage({ params }: PageProps) {
  const { id } = await params;
  const dealerRepo = getDealerRepository();
  let dealer = await dealerRepo.getDealerById(id);

  if (!dealer) {
    dealer = await dealerRepo.getDealerByProfileId(id);
  }
  if (!dealer) {
    dealer = await dealerRepo.getDealerBySlug(id);
  }

  if (dealer && dealer.public_id) {
    redirect(`/premium/${dealer.public_id}`);
  } else if (dealer) {
    redirect(`/premium/${dealer.id}`);
  }

  redirect(`/premium/${id}`);
}

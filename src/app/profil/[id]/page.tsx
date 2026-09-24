import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyProfileRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/user/${id}`);
}

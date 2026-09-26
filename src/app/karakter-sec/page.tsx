import { CharacterSelectContent } from './CharacterSelectContent';

interface CharacterSelectPageProps {
  searchParams: Promise<{
    redirect?: string | string[];
    source?: string | string[];
  }>;
}

export default async function CharacterSelectPage({ searchParams }: CharacterSelectPageProps) {
  const params = await searchParams;
  const redirect = typeof params.redirect === 'string' ? params.redirect : '/';
  const isTestSource = params.source === 'test';

  return <CharacterSelectContent redirect={redirect} isTestSource={isTestSource} />;
}

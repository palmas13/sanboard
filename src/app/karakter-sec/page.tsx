import { CharacterSelectContent } from './CharacterSelectContent';
import { normalizeInternalRedirect } from '@/lib/auth/redirect';

interface CharacterSelectPageProps {
  searchParams: Promise<{
    redirect?: string | string[];
    source?: string | string[];
    account?: string | string[];
  }>;
}

export default async function CharacterSelectPage({ searchParams }: CharacterSelectPageProps) {
  const params = await searchParams;
  const redirect = normalizeInternalRedirect(params.redirect);
  const isTestSource = params.source === 'test';
  const defaultCharacterName = isTestSource && params.account === 'secondary' ? 'John Doe' : null;

  return <CharacterSelectContent redirect={redirect} isTestSource={isTestSource} defaultCharacterName={defaultCharacterName} />;
}

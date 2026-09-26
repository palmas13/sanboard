import { CharacterProfile } from '@/types';

export function selectUnambiguousProfile(
  identifier: string,
  canonicalMatch: CharacterProfile | null,
  externalMatch: CharacterProfile | null
): CharacterProfile | null {
  if (canonicalMatch && externalMatch && canonicalMatch.id !== externalMatch.id) {
    throw new Error(
      `Character profile identifier collision: ${identifier} matches canonical profile ${canonicalMatch.id} and external character profile ${externalMatch.id}.`
    );
  }

  return canonicalMatch || externalMatch;
}
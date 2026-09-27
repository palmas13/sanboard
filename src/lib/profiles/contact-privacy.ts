import type { CharacterProfile, ContactVisibility } from '@/types';

export function normalizeContactVisibility(value: unknown): ContactVisibility | null {
  return value === 'PUBLIC' || value === 'PRIVATE' ? value : null;
}

export function redactPrivateContact(profile?: CharacterProfile | null): CharacterProfile | undefined {
  if (!profile) return undefined;
  return {
    ...profile,
    phone: (profile.phone_visibility || 'PUBLIC') === 'PUBLIC' ? profile.phone : '',
    sanmail_email: (profile.sanmail_visibility || 'PUBLIC') === 'PUBLIC' ? profile.sanmail_email : '',
  };
}
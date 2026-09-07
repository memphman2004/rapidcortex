import { get } from './client';
import type { LanguageRegistryResponse } from '../../types/mobile';

/**
 * Thin API wrapper for the RC language registry.
 * Caching and offline behavior live in `src/services/language.ts`.
 */
export async function fetchLanguagesFromApi(): Promise<LanguageRegistryResponse> {
  const response = await get<LanguageRegistryResponse>(
    '/api/call-intelligence/languages',
  );

  if (!response.data.ok) {
    throw new Error('Language registry request failed');
  }

  return response.data;
}

export async function updateUserPreferredLanguage(
  languageCode: string,
): Promise<{ preferredLanguage: string }> {
  const { updatePreferredLanguage } = await import('./devices');
  return updatePreferredLanguage(languageCode);
}

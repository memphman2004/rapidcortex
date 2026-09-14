/**
 * Public legal URLs for Play Store policy (privacy + account deletion).
 * Must stay on www.rapidcortex.us — Play reviewers open these without login.
 */
export const LEGAL_URLS = {
  privacy: 'https://www.rapidcortex.us/privacy',
  terms: 'https://www.rapidcortex.us/terms',
  accountDeletion: 'https://www.rapidcortex.us/account-deletion',
} as const;

export type LegalUrlKey = keyof typeof LEGAL_URLS;

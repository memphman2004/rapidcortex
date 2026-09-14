import { describe, expect, it } from 'vitest';
import { LEGAL_URLS } from './legal-urls';

describe('LEGAL_URLS', () => {
  it('points Play reviewers at public www pages', () => {
    expect(LEGAL_URLS.privacy).toBe('https://www.rapidcortex.us/privacy');
    expect(LEGAL_URLS.terms).toBe('https://www.rapidcortex.us/terms');
    expect(LEGAL_URLS.accountDeletion).toBe('https://www.rapidcortex.us/account-deletion');
  });
});

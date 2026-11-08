import { describe, expect, it } from 'vitest';
import { isBusinessCardNfcUrl, shortCardId } from './business-card-nfc';

describe('business-card NFC URLs', () => {
  it('accepts permanent /c/{cardId} URLs only', () => {
    expect(isBusinessCardNfcUrl('https://www.nexcortiq.us/c/abc-123')).toBe(true);
    expect(isBusinessCardNfcUrl('https://www.nexcortiq.us/c/abc-123/')).toBe(true);
  });

  it('rejects profile slugs and other hosts', () => {
    expect(isBusinessCardNfcUrl('https://www.nexcortiq.us/card/jeffcoleman')).toBe(false);
    expect(isBusinessCardNfcUrl('https://app.rapidcortex.us/c/abc')).toBe(false);
    expect(isBusinessCardNfcUrl('http://www.nexcortiq.us/c/abc')).toBe(false);
    expect(isBusinessCardNfcUrl('not-a-url')).toBe(false);
  });

  it('shortens card ids for list labels', () => {
    expect(shortCardId('abcdefghijklmnop')).toBe('abcdefgh');
  });
});

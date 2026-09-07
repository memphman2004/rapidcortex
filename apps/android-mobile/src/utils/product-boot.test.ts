import { describe, expect, it } from 'vitest';
import { authenticatedProductHref } from './product-boot';

describe('authenticatedProductHref', () => {
  it('does not route until there is a session', () => {
    expect(
      authenticatedProductHref({
        isAuthenticated: false,
        productPath: 'venue',
        role: 'VENUE_OPERATOR',
        safeSoundPublic: false,
      }),
    ).toBeNull();
  });

  it('routes venue and campus only when role matches', () => {
    expect(
      authenticatedProductHref({
        isAuthenticated: true,
        productPath: 'venue',
        role: 'VENUE_ADMIN',
        safeSoundPublic: false,
      }),
    ).toBe('/(venue)');
    expect(
      authenticatedProductHref({
        isAuthenticated: true,
        productPath: 'campus',
        role: 'dispatcher',
        safeSoundPublic: false,
      }),
    ).toBeNull();
  });

  it('routes transit admin through the venue Field codes path', () => {
    expect(
      authenticatedProductHref({
        isAuthenticated: true,
        productPath: 'venue',
        role: 'TRANSIT_ADMIN',
        safeSoundPublic: false,
      }),
    ).toBe('/(venue)');
  });
});

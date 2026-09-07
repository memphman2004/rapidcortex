import type { ProductPath } from '../stores/auth.store';
import { isCampusRole, isTransitRole, isVenueRole } from './roles';

export type ProductBootHref = '/(venue)' | '/(campus)' | '/(safe-sound)';

/**
 * Where a restored session would go after product selection.
 * Do not <Redirect> there on the first index render — expo-router can paint
 * an empty stack (TestFlight 37: splash then black). Navigate only after
 * the root navigator has a key, and only from an effect.
 */
export function authenticatedProductHref(input: {
  isAuthenticated: boolean;
  productPath: ProductPath | null;
  role: string;
  safeSoundPublic: boolean;
}): ProductBootHref | null {
  if (!input.isAuthenticated) return null;
  if (input.productPath === 'safe-sound' && input.safeSoundPublic) {
    return '/(safe-sound)';
  }
  if (input.productPath === 'venue' && (isVenueRole(input.role) || isTransitRole(input.role))) {
    return '/(venue)';
  }
  if (input.productPath === 'campus' && isCampusRole(input.role)) {
    return '/(campus)';
  }
  return null;
}

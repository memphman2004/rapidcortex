import type { ProductPath } from '@/stores/auth.store';

/** Login route for the active product after sign-out. */
export function loginHrefForProduct(productPath: ProductPath | null): string {
  switch (productPath) {
    case 'campus':
      return '/(auth)/campus-login';
    case 'command':
      return '/(auth)/command-login';
    case 'safe-sound':
      return '/(auth)/safe-sound-login';
    case 'venue':
    default:
      return '/(auth)/venue-login';
  }
}

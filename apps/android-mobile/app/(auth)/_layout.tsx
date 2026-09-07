import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { isSafeSoundPublicEnabled } from '@/utils/feature-flags';
import { isCampusRole, isTransitRole, isVenueRole } from '@/utils/roles';

export default function AuthLayout() {
  const { isAuthenticated, productPath, role } = useAuth();
  const safeSoundPublic = isSafeSoundPublicEnabled();

  // Only leave the login stack once the role matches the selected product.
  // Otherwise a successful Cognito sign-in with a mismatched/legacy role token
  // redirects into /(venue) or /(campus), fails the layout gate, and looks like
  // a dead post-login screen.
  if (isAuthenticated && productPath === 'safe-sound' && safeSoundPublic) {
    return <Redirect href="/(safe-sound)" />;
  }
  if (isAuthenticated && productPath === 'venue' && (isVenueRole(role) || isTransitRole(role))) {
    return <Redirect href="/(venue)" />;
  }
  if (isAuthenticated && productPath === 'campus' && isCampusRole(role)) {
    return <Redirect href="/(campus)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="safe-sound-login" />
      <Stack.Screen name="venue-login" />
      <Stack.Screen name="campus-login" />
    </Stack>
  );
}

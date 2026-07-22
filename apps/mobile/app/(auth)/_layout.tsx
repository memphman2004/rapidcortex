import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { isSafeSoundPublicEnabled } from '@/utils/feature-flags';

export default function AuthLayout() {
  const { isAuthenticated, productPath } = useAuth();
  const safeSoundPublic = isSafeSoundPublicEnabled();

  if (isAuthenticated && productPath === 'safe-sound' && safeSoundPublic) {
    return <Redirect href="/(safe-sound)" />;
  }
  if (isAuthenticated && productPath === 'venue') {
    return <Redirect href="/(venue)" />;
  }
  if (isAuthenticated && productPath === 'campus') {
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

import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout() {
  const { isAuthenticated, productPath } = useAuth();

  if (isAuthenticated && productPath === 'safe-sound') {
    return <Redirect href="/(safe-sound)" />;
  }
  if (isAuthenticated && productPath === 'venue-campus') {
    return <Redirect href="/(venue)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="safe-sound-login" />
      <Stack.Screen name="venue-login" />
    </Stack>
  );
}

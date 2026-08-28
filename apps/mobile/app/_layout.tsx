import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { NATIVE_BOOT_BACKGROUND } from '@/services/native-splash';
import {
  getInitialNotificationRoute,
  registerForPushNotifications,
  setupNotificationHandlers,
  teardownNotificationHandlers,
} from '@/services/notifications';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: NATIVE_BOOT_BACKGROUND }}>
      <SafeAreaProvider>
        <ScreenErrorBoundary>
          <RootLayoutNav />
        </ScreenErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const router = useRouter();
  // Do not gate the tree on auth isLoading — sign-in sets it and would unmount
  // the login screen (Sign In flicker). Hydrate runs in the background.
  const { isAuthenticated, user } = useAuth();
  useLanguage();

  const hasHandledInitialRoute = useRef(false);

  useEffect(() => {
    setupNotificationHandlers();
    return () => teardownNotificationHandlers();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || hasHandledInitialRoute.current) return;
    hasHandledInitialRoute.current = true;

    void registerForPushNotifications(user.sub).catch((err) => {
      console.warn('[notifications] register failed', err);
    });
    void getInitialNotificationRoute()
      .then((route) => {
        if (route) {
          router.push(route as never);
        }
      })
      .catch(() => undefined);
  }, [isAuthenticated, user, router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: NATIVE_BOOT_BACKGROUND },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(safe-sound)" />
        <Stack.Screen name="(venue)" />
        <Stack.Screen name="(campus)" />
        <Stack.Screen
          name="emergency/[eventId]"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }}
        />
      </Stack>
    </>
  );
}

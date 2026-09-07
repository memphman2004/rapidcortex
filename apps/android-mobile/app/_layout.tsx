import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import {
  FONT_READY_TIMEOUT_MS,
  isNativeSplashReadyToHide,
  NATIVE_BOOT_BACKGROUND,
} from '@/services/native-splash';
import {
  getInitialNotificationRoute,
  registerForPushNotifications,
  setupNotificationHandlers,
  teardownNotificationHandlers,
} from '@/services/notifications';

/** React Navigation's default theme is light gray. Without this, Xcode/TestFlight
 *  hide the native splash onto a white native screen (TestFlight 24). */
const bootNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: NATIVE_BOOT_BACKGROUND,
    card: NATIVE_BOOT_BACKGROUND,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: NATIVE_BOOT_BACKGROUND }}>
      <NavigationThemeProvider value={bootNavigationTheme}>
        <SafeAreaProvider>
          <ScreenErrorBoundary>
            <RootLayoutNav />
          </ScreenErrorBoundary>
        </SafeAreaProvider>
      </NavigationThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  // July 22 Android: wait for Inter with a visible spinner so the native
  // splash is not replaced by an empty dark window. Time out so a hung
  // font load cannot block forever (iOS TestFlight).
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const [waitExpired, setWaitExpired] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaitExpired(true), FONT_READY_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);
  const fontsReady = isNativeSplashReadyToHide({
    fontsLoaded,
    fontError,
    waitExpired,
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

  if (!fontsReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: NATIVE_BOOT_BACKGROUND,
        }}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

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

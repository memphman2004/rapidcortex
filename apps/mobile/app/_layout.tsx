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
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import {
  getInitialNotificationRoute,
  registerForPushNotifications,
  setupNotificationHandlers,
  teardownNotificationHandlers,
} from '@/services/notifications';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
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

    void registerForPushNotifications(user.sub);
    void getInitialNotificationRoute().then((route) => {
      if (route) {
        router.push(route as never);
      }
    });
  }, [isAuthenticated, user, router]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00040e' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { useAuthStore } from '@/stores/auth.store';
import { post } from './api/client';

export type NotificationRouteType =
  | 'GUARDIAN_EMERGENCY'
  | 'GEOFENCE_ALERT'
  | 'CODE_CREATED'
  | 'DEVICE_ALERT';

export interface PushRegistrationResult {
  granted: boolean;
  expoPushToken: string | null;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function getEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const projectId = getEasProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  return tokenResponse.data;
}

export async function registerForPushNotifications(
  userId: string,
): Promise<PushRegistrationResult> {
  const granted = await requestNotificationPermissions();
  if (!granted) {
    return { granted: false, expoPushToken: null };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Rapid Cortex Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [500, 200, 500, 200],
      lightColor: '#1B4FD8',
    });
  }

  const token = await getExpoPushToken();
  if (!token) {
    return { granted: true, expoPushToken: null };
  }

  await post('/api/users/push-token', {
    token,
    platform: Platform.OS,
    userId,
  });

  return { granted: true, expoPushToken: token };
}

function routeFromNotificationData(data: Record<string, unknown>): void {
  const type = String(data.type ?? '') as NotificationRouteType;

  if (type === 'GUARDIAN_EMERGENCY' && data.eventId) {
    router.push(`/emergency/${String(data.eventId)}`);
    return;
  }

  if (type === 'GEOFENCE_ALERT' && data.deviceId) {
    router.push(`/(safe-sound)/device/${String(data.deviceId)}`);
    return;
  }

  if (type === 'CODE_CREATED') {
    const product = useAuthStore.getState().productPath;
    router.push(product === 'campus' ? '/(campus)/' : '/(venue)/');
  }
}
let responseSubscription: Notifications.Subscription | null = null;
let receivedSubscription: Notifications.Subscription | null = null;

export function setupNotificationHandlers(): void {
  if (responseSubscription || receivedSubscription) return;

  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      if (data && typeof data === 'object') {
        routeFromNotificationData(data as Record<string, unknown>);
      }
    },
  );

  receivedSubscription = Notifications.addNotificationReceivedListener(() => {
    // Foreground notifications are rendered by the OS handler above.
  });
}

export function teardownNotificationHandlers(): void {
  responseSubscription?.remove();
  receivedSubscription?.remove();
  responseSubscription = null;
  receivedSubscription = null;
}

export async function getInitialNotificationRoute(): Promise<string | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;

  const data = response.notification.request.content.data;
  if (!data || typeof data !== 'object') return null;

  const type = String((data as Record<string, unknown>).type ?? '');
  if (type === 'GUARDIAN_EMERGENCY' && (data as Record<string, unknown>).eventId) {
    return `/emergency/${String((data as Record<string, unknown>).eventId)}`;
  }

  return null;
}

export async function scheduleLocalTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rapid Cortex',
      body: 'Notifications are configured.',
      data: { type: 'DEVICE_ALERT' },
    },
    trigger: null,
  });
}

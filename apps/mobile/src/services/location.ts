import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { getBackgroundAccessToken } from './api/auth';
import { resolveApiBase } from './api/client';

const BACKGROUND_LOCATION_TASK = 'RC_GUARDIAN_LOCATION';
const GUARDIAN_DEVICE_ID_KEY = 'guardian_device_id';

export type LocationPermissionState =
  | 'granted'
  | 'denied'
  | 'foreground_only'
  | 'unavailable';

export interface CurrentLocationResult {
  snapshot: {
    lat: number;
    lng: number;
    accuracy: number | null;
    altitude: number | null;
    timestamp: string;
    source: 'phone_gps';
  };
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  const latest = locations[locations.length - 1];
  if (!latest) return;

  const deviceId = await SecureStore.getItemAsync(GUARDIAN_DEVICE_ID_KEY);
  if (!deviceId) return;

  const accessToken = await getBackgroundAccessToken();
  if (!accessToken) return;

  const path = `/api/safe-sound/devices/${deviceId}/location`;
  const url = `${resolveApiBase(path)}${path}`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        lat: latest.coords.latitude,
        lng: latest.coords.longitude,
        accuracy: latest.coords.accuracy,
        altitude: latest.coords.altitude,
        source: 'phone_gps',
        timestamp: new Date(latest.timestamp).toISOString(),
      }),
    });
  } catch (postError) {
    console.error('Failed to post background location:', postError);
  }
});

export async function requestForegroundLocationPermission(): Promise<LocationPermissionState> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return 'unavailable';

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'unavailable';
}

export async function requestBackgroundLocationPermission(): Promise<LocationPermissionState> {
  const foreground = await requestForegroundLocationPermission();
  if (foreground !== 'granted') return foreground;

  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'foreground_only';
}

export async function getCurrentLocation(): Promise<CurrentLocationResult> {
  const permission = await requestForegroundLocationPermission();
  if (permission !== 'granted') {
    throw new Error('LOCATION_PERMISSION_DENIED');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    snapshot: {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      timestamp: new Date(position.timestamp).toISOString(),
      source: 'phone_gps',
    },
  };
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!results.length) return null;
    const place = results[0];
    const parts = [
      place.name,
      place.street,
      place.city,
      place.region,
      place.postalCode,
    ].filter(Boolean);
    return parts.join(', ') || null;
  } catch {
    return null;
  }
}

export async function startGuardianTracking(deviceId: string): Promise<void> {
  await SecureStore.setItemAsync(GUARDIAN_DEVICE_ID_KEY, deviceId);

  const permission = await requestBackgroundLocationPermission();
  if (permission !== 'granted') {
    throw new Error('BACKGROUND_LOCATION_DENIED');
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    BACKGROUND_LOCATION_TASK,
  );
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 30_000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Rapid Cortex Guardian',
      notificationBody: 'Sharing location for emergency detection',
      notificationColor: '#1B4FD8',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Other,
  });
}

export async function stopGuardianTracking(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    BACKGROUND_LOCATION_TASK,
  );
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
  await SecureStore.deleteItemAsync(GUARDIAN_DEVICE_ID_KEY);
}

export async function isGuardianTrackingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
}

export function locationErrorMessage(code: string): string {
  switch (code) {
    case 'LOCATION_PERMISSION_DENIED':
      return 'Location permission is required to show your position and share it during emergencies.';
    case 'BACKGROUND_LOCATION_DENIED':
      return 'Background location is required for Guardian emergency detection.';
    default:
      return 'Unable to access location services.';
  }
}

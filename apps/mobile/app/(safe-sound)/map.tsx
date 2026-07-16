import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentLocation } from '@/services/location';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import type { LocationSnapshot, SSDevice } from '@/types/mobile';

export default function SafeSoundMapScreen() {
  const router = useRouter();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const palette = colors as { background: string; surface: string; textPrimary: string; blue: string; border: string };

  const devices = useDevicesStore((state) => state.devices);
  const locations = useDevicesStore((state) => state.locations);
  const fetchDevices = useDevicesStore((state) => state.fetchDevices);
  const fetchDeviceLocation = useDevicesStore((state) => state.fetchDeviceLocation);

  const mapRef = useRef<MapView | null>(null);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    devices.forEach((device) => {
      void fetchDeviceLocation(device.deviceId);
    });
  }, [devices, fetchDeviceLocation]);

  const markers = useMemo(
    () =>
      devices
        .map((device) => {
          const location = locations[device.deviceId];
          if (!location) return null;
          return { device, location };
        })
        .filter(
          (entry): entry is { device: SSDevice; location: LocationSnapshot } => entry !== null,
        ),
    [devices, locations],
  );

  const initialRegion = {
    latitude: markers[0]?.location.lat ?? 39.8283,
    longitude: markers[0]?.location.lng ?? -98.5795,
    latitudeDelta: markers.length ? 0.05 : 30,
    longitudeDelta: markers.length ? 0.05 : 30,
  };

  const zoomToFit = () => {
    if (!mapRef.current || markers.length === 0) return;
    mapRef.current.fitToCoordinates(
      markers.map((entry) => ({ latitude: entry.location.lat, longitude: entry.location.lng })),
      { edgePadding: { top: 80, bottom: 80, left: 80, right: 80 }, animated: true },
    );
  };

  const locateMe = async () => {
    try {
      const result = await getCurrentLocation();
      setMyLocation({ latitude: result.snapshot.lat, longitude: result.snapshot.lng });
      mapRef.current?.animateToRegion(
        {
          latitude: result.snapshot.lat,
          longitude: result.snapshot.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        400,
      );
    } catch {
      // location unavailable — silently ignore, permission prompts already surfaced by OS
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {markers.map((entry) => (
          <Marker
            key={entry.device.deviceId}
            coordinate={{ latitude: entry.location.lat, longitude: entry.location.lng }}
            title={entry.device.name}
            description={entry.device.type === 'home' ? Strings.safeSound.deviceTypes.home : Strings.safeSound.deviceTypes.guardian}
            pinColor={palette.blue}
            onCalloutPress={() => router.push(`/(safe-sound)/device/${entry.device.deviceId}`)}
          />
        ))}
        {myLocation ? <Marker coordinate={myLocation} pinColor="#22C55E" title="You" /> : null}
      </MapView>

      <View
        style={{
          position: 'absolute',
          right: spacing['4'],
          bottom: spacing['6'],
          gap: spacing['3'],
        }}
      >
        <Pressable
          onPress={zoomToFit}
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: borderRadius.full,
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['2.5'],
          }}
        >
          <Text style={[typography.label, { color: palette.textPrimary }]}>{Strings.safeSound.map.zoomToFit}</Text>
        </Pressable>
        <Pressable
          onPress={locateMe}
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: borderRadius.full,
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['2.5'],
          }}
        >
          <Text style={[typography.label, { color: palette.textPrimary }]}>{Strings.safeSound.map.locateMe}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

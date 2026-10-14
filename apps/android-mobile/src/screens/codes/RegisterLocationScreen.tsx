import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { getCode } from '@/services/api/codes';
import {
  getCurrentLocation,
  locationErrorMessage,
  requestForegroundLocationPermission,
} from '@/services/location';
import { useCodesStore } from '@/stores/codes.store';
import { useTheme } from '@/theme';
import type { RCCode } from '@/types/mobile';

type Pin = { latitude: number; longitude: number };

function regionFor(pin: Pin, accuracyMeters: number | null): Region {
  const delta = Math.max(0.0015, Math.min(0.02, (accuracyMeters ?? 25) / 5000));
  return {
    latitude: pin.latitude,
    longitude: pin.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

/**
 * Field install workflow: foreground GPS → map preview → drag pin → save UNVERIFIED
 * → optional explicit "Verify Installation Location". Never auto-verifies.
 */
export default function RegisterLocationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    background: string;
    textPrimary: string;
    textSecondary: string;
    amber: string;
    emerald: string;
    red: string;
    border: string;
  };
  const patchCode = useCodesStore((s) => s.patchCode);

  const [code, setCode] = useState<RCCode | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [altitudeMeters, setAltitudeMeters] = useState<number | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getCode(id).then((c) => {
      setCode(c);
      if (c.latitude != null && c.longitude != null) {
        const next = { latitude: c.latitude, longitude: c.longitude };
        setPin(next);
        setAccuracyMeters(c.locationAccuracyMeters ?? null);
        setRegion(regionFor(next, c.locationAccuracyMeters ?? null));
      }
    }).catch(() => setError('Unable to load code.'));
  }, [id]);

  const captureGps = useCallback(async () => {
    setCapturing(true);
    setError(null);
    try {
      const permission = await requestForegroundLocationPermission();
      if (permission !== 'granted') {
        throw new Error('LOCATION_PERMISSION_DENIED');
      }
      const { snapshot } = await getCurrentLocation();
      const next = { latitude: snapshot.lat, longitude: snapshot.lng };
      setPin(next);
      setAccuracyMeters(snapshot.accuracy);
      setAltitudeMeters(snapshot.altitude);
      setRegion(regionFor(next, snapshot.accuracy));
    } catch (e) {
      const codeName = e instanceof Error ? e.message : 'UNKNOWN';
      setError(locationErrorMessage(codeName));
    } finally {
      setCapturing(false);
    }
  }, []);

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ latitude, longitude });
    setAccuracyMeters(null);
  };

  const saveUnverified = async () => {
    if (!code || !pin) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await patchCode(code.codeId, {
        latitude: pin.latitude,
        longitude: pin.longitude,
        locationAccuracyMeters: accuracyMeters,
        altitudeMeters: altitudeMeters ?? undefined,
        locationSource: 'gps',
        // Explicit omission — never auto-verify on save.
        markLocationVerified: false,
      });
      setCode(updated);
      Alert.alert(
        'Location saved',
        'Coordinates are UNVERIFIED. Confirm with Verify Installation Location when the pin is correct.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const verifyInstallation = () => {
    if (!code || !pin) return;
    Alert.alert(
      'Verify Installation Location',
      'Confirm you are standing at the installed QR/NFC sign and the map pin is accurate. This cannot be undone without re-editing coordinates.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          style: 'default',
          onPress: async () => {
            setVerifying(true);
            setError(null);
            try {
              // Re-save pin then verify so verify never stamps stale coords.
              const updated = await patchCode(code.codeId, {
                latitude: pin.latitude,
                longitude: pin.longitude,
                locationAccuracyMeters: accuracyMeters,
                altitudeMeters: altitudeMeters ?? undefined,
                locationSource: 'gps',
                markLocationVerified: true,
              });
              setCode(updated);
              Alert.alert('Verified', 'Installation location is now VERIFIED.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Verify failed');
            } finally {
              setVerifying(false);
            }
          },
        },
      ],
    );
  };

  if (!code) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={palette.amber} />
      </SafeAreaView>
    );
  }

  const verified = code.locationVerified === true;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: palette.background }]} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.amber }]}>‹ Back</Text>
        </Pressable>
        <Text style={[typography.label, { color: verified ? palette.emerald : palette.amber }]}>
          {verified ? 'VERIFIED' : 'UNVERIFIED'}
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing['5'], paddingTop: spacing['3'] }}>
        <Text style={[typography.h2, { color: palette.textPrimary }]}>Register location</Text>
        <Text style={[typography.body, { color: palette.textSecondary, marginTop: 4 }]}>
          {code.name} · {code.zone}
        </Text>
        <Text style={[typography.caption, { color: palette.textSecondary, marginTop: 8 }]}>
          Capture GPS at the sign, drag the pin to correct, then save. Verification is a separate step.
        </Text>
      </View>

      <View style={[styles.mapWrap, { borderColor: palette.border, margin: spacing['5'] }]}>
        {region && pin ? (
          <MapView
            style={StyleSheet.absoluteFill}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={onMapPress}
            showsUserLocation
            showsMyLocationButton
          >
            <Marker
              coordinate={pin}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setPin({ latitude, longitude });
                setAccuracyMeters(null);
              }}
              title={code.name}
              description="Drag to adjust installation pin"
            />
          </MapView>
        ) : (
          <View style={[styles.fill, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
            <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
              Capture GPS to show the map, or wait for an existing pin to load.
            </Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing['5'], gap: 8 }}>
        {pin ? (
          <Text style={[typography.caption, { color: palette.textSecondary }]}>
            Lat {pin.latitude.toFixed(6)} · Lng {pin.longitude.toFixed(6)}
            {accuracyMeters != null ? ` · ±${Math.round(accuracyMeters)} m` : ' · pin adjusted'}
          </Text>
        ) : null}
        {error ? (
          <Text style={[typography.caption, { color: palette.red }]}>{error}</Text>
        ) : null}

        <Button
          title={capturing ? 'Capturing…' : 'Capture GPS'}
          variant="secondary"
          onPress={() => void captureGps()}
          disabled={capturing || saving || verifying}
        />
        <Button
          title={saving ? 'Saving…' : 'Save installation pin'}
          onPress={() => void saveUnverified()}
          disabled={!pin || saving || verifying || capturing}
        />
        <Button
          title={verifying ? 'Verifying…' : 'Verify Installation Location'}
          variant="secondary"
          onPress={verifyInstallation}
          disabled={!pin || saving || verifying || capturing || verified}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  mapWrap: {
    flex: 1,
    minHeight: 280,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

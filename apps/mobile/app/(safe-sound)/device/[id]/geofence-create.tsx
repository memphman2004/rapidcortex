import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { getCurrentLocation } from '@/services/location';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import { validateRequired } from '@/utils/validation';

const RADIUS_PRESETS_METERS = [50, 100, 250, 500, 1000];

export default function GeofenceCreateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string; red: string; border: string };

  const deviceLocation = useDevicesStore((state) => state.locations[id]);
  const addGeofence = useDevicesStore((state) => state.addGeofence);

  const [center, setCenter] = useState({ latitude: 39.8283, longitude: -98.5795 });
  const [hasCenter, setHasCenter] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(250);
  const [name, setName] = useState('');
  const [alertOnEnter, setAlertOnEnter] = useState(true);
  const [alertOnExit, setAlertOnExit] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (deviceLocation) {
      setCenter({ latitude: deviceLocation.lat, longitude: deviceLocation.lng });
      setHasCenter(true);
      return;
    }
    void getCurrentLocation()
      .then((result) => {
        setCenter({ latitude: result.snapshot.lat, longitude: result.snapshot.lng });
        setHasCenter(true);
      })
      .catch(() => setHasCenter(true));
  }, [deviceLocation]);

  const handleSave = async () => {
    setError(null);
    const nameResult = validateRequired(name, Strings.geofence.name);
    if (!nameResult.valid) return setError(nameResult.error ?? null);

    setSaving(true);
    try {
      await addGeofence(id, {
        name,
        shape: 'circle',
        centerLat: center.latitude,
        centerLng: center.longitude,
        radiusMeters,
        alertOnEnter,
        alertOnExit,
      });
      router.back();
    } catch {
      Alert.alert(Strings.common.somethingWentWrong);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'], paddingBottom: spacing['3'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.blue }]}>‹ {Strings.common.cancel}</Text>
        </Pressable>
        <Text style={[typography.h2, { color: palette.textPrimary }]}>{Strings.geofence.create}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={{ height: 280 }}>
        {hasCenter ? (
          <MapView
            style={{ flex: 1 }}
            initialRegion={{ ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          >
            <Marker
              coordinate={center}
              draggable
              onDragEnd={(event) => setCenter(event.nativeEvent.coordinate)}
              pinColor={palette.blue}
            />
            <Circle
              center={center}
              radius={radiusMeters}
              strokeColor={palette.blue}
              fillColor={`${palette.blue}33`}
            />
          </MapView>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}>
        <Text style={[typography.caption, { color: palette.textSecondary, marginBottom: spacing['4'] }]}>
          Drag the pin to set the geofence center.
        </Text>

        <Input label={Strings.geofence.name} value={name} onChangeText={setName} placeholder="Home" />

        <Text style={[typography.label, { color: palette.textPrimary, marginTop: spacing['4'], marginBottom: spacing['2'] }]}>
          Radius
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {RADIUS_PRESETS_METERS.map((preset) => (
            <Pressable key={preset} onPress={() => setRadiusMeters(preset)}>
              <Badge
                label={preset >= 1000 ? `${preset / 1000} km` : `${preset} m`}
                tone={radiusMeters === preset ? 'accent' : 'neutral'}
              />
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['5'] }}>
          <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.geofence.alertOnEnter}</Text>
          <Switch value={alertOnEnter} onValueChange={setAlertOnEnter} trackColor={{ true: palette.blue }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['3'], marginBottom: spacing['5'] }}>
          <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.geofence.alertOnExit}</Text>
          <Switch value={alertOnExit} onValueChange={setAlertOnExit} trackColor={{ true: palette.blue }} />
        </View>

        {error ? <Text style={[typography.caption, { color: palette.red, marginBottom: spacing['3'] }]}>{error}</Text> : null}

        <Button title={Strings.geofence.save} onPress={handleSave} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

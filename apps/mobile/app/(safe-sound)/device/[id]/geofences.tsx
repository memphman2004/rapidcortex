import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

export default function DeviceGeofencesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string; red: string };

  const geofences = useDevicesStore((state) => state.geofences[id]) ?? [];
  const isLoading = useDevicesStore((state) => state.geofencesLoading[id]) ?? false;
  const fetchGeofences = useDevicesStore((state) => state.fetchGeofences);
  const removeGeofence = useDevicesStore((state) => state.removeGeofence);

  useEffect(() => {
    void fetchGeofences(id);
  }, [id, fetchGeofences]);

  const handleDelete = (geofenceId: string, name: string) => {
    Alert.alert(name, 'Delete this geofence?', [
      { text: Strings.common.cancel, style: 'cancel' },
      {
        text: Strings.common.delete,
        style: 'destructive',
        onPress: () => void removeGeofence(id, geofenceId).catch(() => Alert.alert(Strings.common.somethingWentWrong)),
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'], paddingBottom: spacing['3'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.blue }]}>‹ Back</Text>
        </Pressable>
        <Text style={[typography.h2, { color: palette.textPrimary }]}>{Strings.safeSound.geofences}</Text>
        <Pressable onPress={() => router.push(`/(safe-sound)/device/${id}/geofence-create`)}>
          <Text style={[typography.h3, { color: palette.blue }]}>+</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing['5'], paddingBottom: spacing['10'] }}>
        {geofences.length === 0 && !isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: spacing['10'] }}>
            <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
              No geofences yet. Create one to get alerts when this device enters or leaves an area.
            </Text>
          </View>
        ) : (
          geofences.map((geofence) => (
            <Card key={geofence.geofenceId} style={{ marginBottom: spacing['3'] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.h3, { color: palette.textPrimary }]}>{geofence.name}</Text>
                  <Text style={[typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
                    {geofence.shape === 'circle' ? `${geofence.radiusMeters ?? 0} m radius` : Strings.geofence.polygon}
                  </Text>
                </View>
                <Badge label={geofence.active ? Strings.venue.filters.active : Strings.venue.filters.inactive} tone={geofence.active ? 'success' : 'neutral'} size="sm" />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing['3'] }}>
                {geofence.alertOnEnter ? <Badge label={Strings.geofence.alertOnEnter} tone="neutral" size="sm" /> : null}
                {geofence.alertOnExit ? <Badge label={Strings.geofence.alertOnExit} tone="neutral" size="sm" /> : null}
              </View>

              <Text
                style={[typography.label, { color: palette.red, marginTop: spacing['3'] }]}
                onPress={() => handleDelete(geofence.geofenceId, geofence.name)}
              >
                {Strings.common.delete}
              </Text>
            </Card>
          ))
        )}

        <Button title={Strings.geofence.create} onPress={() => router.push(`/(safe-sound)/device/${id}/geofence-create`)} />
      </ScrollView>
    </SafeAreaView>
  );
}

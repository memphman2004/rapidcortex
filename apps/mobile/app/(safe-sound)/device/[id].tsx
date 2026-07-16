import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { BatteryBar } from '@/components/safe-sound/BatteryBar';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { formatBatteryDaysRemaining, formatRelativeTime } from '@/utils/format';
import { Strings } from '@/utils/strings';

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, typography, spacing, layout, borderRadius } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string; red: string; border: string };

  const device = useDevicesStore((state) => state.getDeviceById(id));
  const location = useDevicesStore((state) => state.locations[id]);
  const fetchDeviceLocation = useDevicesStore((state) => state.fetchDeviceLocation);
  const refreshDevice = useDevicesStore((state) => state.refreshDevice);
  const toggleLostMode = useDevicesStore((state) => state.toggleLostMode);
  const toggleRcCoreConsent = useDevicesStore((state) => state.toggleRcCoreConsent);
  const removeDevice = useDevicesStore((state) => state.removeDevice);

  const [lostModeBusy, setLostModeBusy] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  useEffect(() => {
    void refreshDevice(id);
    void fetchDeviceLocation(id);
  }, [id, refreshDevice, fetchDeviceLocation]);

  if (!device) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.common.loading}</Text>
      </SafeAreaView>
    );
  }

  const handleToggleLostMode = async (value: boolean) => {
    setLostModeBusy(true);
    try {
      await toggleLostMode(id, value);
    } catch {
      Alert.alert(Strings.common.somethingWentWrong);
    } finally {
      setLostModeBusy(false);
    }
  };

  const handleToggleConsent = async (value: boolean) => {
    setConsentBusy(true);
    try {
      await toggleRcCoreConsent(id, value);
    } catch {
      Alert.alert(Strings.common.somethingWentWrong);
    } finally {
      setConsentBusy(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(Strings.safeSound.deleteDeviceTitle, Strings.safeSound.deleteDeviceMessage, [
      { text: Strings.common.cancel, style: 'cancel' },
      {
        text: Strings.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await removeDevice(id);
            router.back();
          } catch {
            Alert.alert(Strings.common.somethingWentWrong);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.blue }]}>‹ Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
          <Text style={[typography.h1, { color: palette.textPrimary }]}>{device.name}</Text>
          <Badge
            label={device.type === 'home' ? Strings.safeSound.deviceTypes.home : Strings.safeSound.deviceTypes.guardian}
            tone="accent"
          />
        </View>

        {location ? (
          <View style={{ height: layout.mapPreviewHeight, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing['4'] }}>
            <MapView
              style={{ flex: 1 }}
              scrollEnabled={false}
              zoomEnabled={false}
              pointerEvents="none"
              initialRegion={{
                latitude: location.lat,
                longitude: location.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} pinColor={palette.blue} />
            </MapView>
          </View>
        ) : null}

        <Card style={{ marginBottom: spacing['4'] }}>
          <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
            {Strings.safeSound.battery.toUpperCase()}
          </Text>
          <BatteryBar percent={device.batteryPct} />
          {device.type === 'guardian' && device.batteryPct != null ? (
            <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
              {formatBatteryDaysRemaining(device.batteryPct)} remaining
            </Text>
          ) : null}
          {device.lastSeenAt ? (
            <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['1'] }]}>
              {Strings.safeSound.lastSeen(formatRelativeTime(device.lastSeenAt))}
            </Text>
          ) : null}
        </Card>

        <Card style={{ marginBottom: spacing['4'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.safeSound.lostMode}</Text>
            <Switch value={device.lostModeActive} onValueChange={handleToggleLostMode} disabled={lostModeBusy} trackColor={{ true: palette.red }} />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing['4'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary, flex: 1, marginRight: 12 }]}>
              {Strings.safeSound.rcCoreConsentTitle}
            </Text>
            <Switch value={device.rcCoreConsent} onValueChange={handleToggleConsent} disabled={consentBusy} trackColor={{ true: palette.blue }} />
          </View>
          <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
            {Strings.safeSound.rcCoreConsentSubtitle}
          </Text>
        </Card>

        <Card onPress={() => router.push(`/(safe-sound)/device/${id}/history`)} style={{ marginBottom: spacing['3'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.safeSound.locationHistory}</Text>
            <Text style={{ color: palette.textSecondary }}>›</Text>
          </View>
        </Card>

        <Card onPress={() => router.push(`/(safe-sound)/device/${id}/geofences`)} style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.safeSound.geofences}</Text>
            <Text style={{ color: palette.textSecondary }}>›</Text>
          </View>
        </Card>

        <Button title={Strings.safeSound.deleteDeviceTitle} variant="danger" onPress={handleDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

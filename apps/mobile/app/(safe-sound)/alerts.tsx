import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { formatRelativeTime } from '@/utils/format';
import { Strings } from '@/utils/strings';
import type { SSDevice } from '@/types/mobile';

interface AlertItem {
  id: string;
  deviceId: string;
  deviceName: string;
  title: string;
  icon: string;
  tone: BadgeTone;
  timestamp: string;
}

function buildAlerts(devices: SSDevice[]): AlertItem[] {
  const items: AlertItem[] = [];

  for (const device of devices) {
    if (device.lostModeActive) {
      items.push({
        id: `${device.deviceId}-lost`,
        deviceId: device.deviceId,
        deviceName: device.name,
        title: Strings.safeSound.alerts.lostModeActivated,
        icon: '🚨',
        tone: 'danger',
        timestamp: device.updatedAt,
      });
    }

    if (device.batteryPct != null && device.batteryPct <= 20) {
      items.push({
        id: `${device.deviceId}-battery`,
        deviceId: device.deviceId,
        deviceName: device.name,
        title: Strings.safeSound.alerts.lowBattery,
        icon: '🔋',
        tone: 'warning',
        timestamp: device.updatedAt,
      });
    }

    if (device.status === 'offline') {
      items.push({
        id: `${device.deviceId}-offline`,
        deviceId: device.deviceId,
        deviceName: device.name,
        title: Strings.safeSound.alerts.deviceOffline,
        icon: '📴',
        tone: 'neutral',
        timestamp: device.lastSeenAt ?? device.updatedAt,
      });
    }
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export default function SafeSoundAlertsScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string };

  const devices = useDevicesStore((state) => state.devices);
  const fetchDevices = useDevicesStore((state) => state.fetchDevices);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  const alerts = useMemo(() => buildAlerts(devices), [devices]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing['5'], paddingTop: spacing['4'], paddingBottom: spacing['3'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary }]}>{Strings.safeSound.alerts.title}</Text>
      </View>

      {alerts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['8'] }}>
          <Text style={{ fontSize: 48, marginBottom: spacing['4'] }}>✅</Text>
          <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
            No active alerts. Everything looks good.
          </Text>
        </View>
      ) : (
        <FlashList
          data={alerts}
          keyExtractor={(item) => item.id}
          estimatedItemSize={90}
          contentContainerStyle={{ paddingHorizontal: spacing['5'], paddingBottom: spacing['8'] }}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/(safe-sound)/device/${item.deviceId}`)} style={{ marginBottom: spacing['3'] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 28 }}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{item.title}</Text>
                  <Text style={[typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
                    {item.deviceName} · {formatRelativeTime(item.timestamp)}
                  </Text>
                </View>
                <Badge label={item.tone === 'danger' ? '!' : '•'} tone={item.tone} size="sm" />
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

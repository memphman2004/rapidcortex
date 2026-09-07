import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { formatRelativeTime } from '@/utils/format';
import { Strings } from '@/utils/strings';
import type { SSDevice } from '@/types/mobile';
import { Badge, type BadgeTone } from '../common/Badge';
import { Card } from '../common/Card';
import { BatteryBar } from './BatteryBar';

export interface DeviceCardProps {
  device: SSDevice;
  onPress: () => void;
}

function deviceStatusLabel(device: SSDevice): { label: string; tone: BadgeTone } {
  if (device.lostModeActive) {
    return { label: Strings.safeSound.status.lostMode, tone: 'danger' };
  }
  if (device.status === 'offline') {
    return { label: Strings.safeSound.status.offline, tone: 'neutral' };
  }

  if (!device.lastSeenAt) {
    return { label: Strings.safeSound.status.offline, tone: 'neutral' };
  }

  const minutesAgo = (Date.now() - new Date(device.lastSeenAt).getTime()) / 60_000;
  if (minutesAgo <= 2) return { label: Strings.safeSound.status.inRange, tone: 'success' };
  if (minutesAgo <= 10) return { label: Strings.safeSound.status.recentlySeen, tone: 'accent' };
  if (minutesAgo <= 60) return { label: Strings.safeSound.status.warning, tone: 'warning' };
  return { label: Strings.safeSound.status.offline, tone: 'neutral' };
}

export function DeviceCard({ device, onPress }: DeviceCardProps) {
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { textPrimary: string; textSecondary: string; purple?: string };
  const status = deviceStatusLabel(device);

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing['3'] }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h3, { color: palette.textPrimary }]} numberOfLines={1}>
            {device.name}
          </Text>
          <Text style={[typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
            {device.type === 'home' ? Strings.safeSound.deviceTypes.home : Strings.safeSound.deviceTypes.guardian}
            {' · '}
            {device.mountType}
          </Text>
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>

      {device.lastSeenAt ? (
        <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
          {Strings.safeSound.lastSeen(formatRelativeTime(device.lastSeenAt))}
        </Text>
      ) : null}

      <View style={{ marginTop: spacing['3'] }}>
        <BatteryBar percent={device.batteryPct} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
});

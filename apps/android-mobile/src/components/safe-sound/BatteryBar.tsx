import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { formatBatteryPercent, getBatteryLevel } from '@/utils/format';

export interface BatteryBarProps {
  percent: number | null | undefined;
  showLabel?: boolean;
}

export function BatteryBar({ percent, showLabel = true }: BatteryBarProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const palette = colors as {
    surfaceAlt: string;
    textSecondary: string;
    green?: string;
    amber: string;
    red: string;
  };

  if (percent == null) {
    return (
      <Text style={[typography.caption, { color: palette.textSecondary }]}>Battery unknown</Text>
    );
  }

  const level = getBatteryLevel(percent);
  const color =
    level === 'high'
      ? palette.green ?? '#22C55E'
      : level === 'medium'
        ? palette.amber
        : palette.red;

  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.track,
          { backgroundColor: palette.surfaceAlt, borderRadius: borderRadius.full },
        ]}
      >
        <View
          style={[
            styles.fill,
            { width: `${clamped}%`, backgroundColor: color, borderRadius: borderRadius.full },
          ]}
        />
      </View>
      {showLabel ? (
        <Text style={[typography.caption, { color, marginLeft: spacing['2'] }]}>
          {formatBatteryPercent(percent)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
  },
});

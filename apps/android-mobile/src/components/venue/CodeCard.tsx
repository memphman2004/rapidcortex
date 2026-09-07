import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { formatRelativeTime } from '@/utils/format';
import { Strings } from '@/utils/strings';
import type { RCCode } from '@/types/mobile';
import { Badge } from '../common/Badge';

export interface CodeCardProps {
  code: RCCode;
  onPress: () => void;
  /** Opens NFC programming directly. */
  onProgramNfc?: () => void;
}

export function CodeCard({ code, onPress, onProgramNfc }: CodeCardProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const palette = colors as {
    textPrimary: string;
    textSecondary: string;
    amber: string;
    surface: string;
    surfaceAlt: string;
    border: string;
  };
  const lastActivity = code.metrics.lastNfcTap ?? code.metrics.lastQrScan ?? null;
  const isNfcWritten = code.nfcWriteLog.length > 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: borderRadius.lg,
          padding: spacing['4'],
          marginBottom: spacing['3'],
        },
      ]}
    >
      <Pressable onPress={onPress} accessibilityRole="button">
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: palette.textPrimary }]} numberOfLines={1}>
              {code.name}
            </Text>
            <Text
              style={[typography.caption, { color: palette.textSecondary, marginTop: 2 }]}
              numberOfLines={1}
            >
              {code.zone}
            </Text>
          </View>
          <Badge
            label={
              code.vertical === 'venue'
                ? Strings.venue.vertical.venue
                : Strings.venue.vertical.campus
            }
            tone="accent"
            size="sm"
          />
        </View>

        <View style={[styles.badgeRow, { marginTop: spacing['3'] }]}>
          <Badge
            label={
              code.status === 'active'
                ? Strings.venue.filters.active
                : Strings.venue.filters.inactive
            }
            tone={code.status === 'active' ? 'success' : 'neutral'}
            size="sm"
          />
          <Badge
            label={isNfcWritten ? Strings.venue.nfcWritten : Strings.venue.notProgrammed}
            tone={isNfcWritten ? 'success' : 'warning'}
            size="sm"
          />
        </View>

        <View style={[styles.metricsRow, { marginTop: spacing['3'] }]}>
          <Text style={[typography.caption, { color: palette.textSecondary }]}>
            {Strings.venue.signPackage.nfcTaps}: {code.metrics.nfcTaps}
          </Text>
          <Text style={[typography.caption, { color: palette.textSecondary }]}>
            {Strings.venue.signPackage.qrScans}: {code.metrics.qrScans}
          </Text>
        </View>

        {lastActivity ? (
          <Text
            style={[
              typography.caption,
              { color: palette.textSecondary, marginTop: spacing['1'] },
            ]}
          >
            {Strings.venue.lastActivity}: {formatRelativeTime(lastActivity)}
          </Text>
        ) : null}

        <Text
          style={[
            typography.caption,
            { color: palette.amber, marginTop: spacing['2'] },
          ]}
        >
          View QR & details →
        </Text>
      </Pressable>

      {onProgramNfc ? (
        <Pressable
          onPress={onProgramNfc}
          accessibilityRole="button"
          accessibilityLabel={Strings.venue.signPackage.programNfc}
          style={{
            marginTop: spacing['3'],
            paddingVertical: spacing['3'],
            paddingHorizontal: spacing['3'],
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: palette.amber,
            backgroundColor: palette.surfaceAlt,
            alignItems: 'center',
          }}
        >
          <Text style={[typography.label, { color: palette.amber }]}>
            {Strings.venue.signPackage.programNfc}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
  },
});

import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { formatAccuracyMeters, formatTimestamp } from '@/utils/format';
import { Strings } from '@/utils/strings';
import type { SSLocationEvent } from '@/types/mobile';

const SOURCE_LABEL: Record<string, string> = {
  gps: Strings.location.sources.gps,
  cellular: Strings.location.sources.cellular,
  bluetooth: Strings.location.sources.bluetooth,
  community: Strings.location.sources.community,
  phone_gps: Strings.location.sources.phoneGps,
};

export default function DeviceHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string };

  const events = useDevicesStore((state) => state.history[id]) ?? [];
  const isLoading = useDevicesStore((state) => state.historyLoading[id]) ?? false;
  const fetchDeviceHistory = useDevicesStore((state) => state.fetchDeviceHistory);

  useEffect(() => {
    void fetchDeviceHistory(id, { limit: 100 });
  }, [id, fetchDeviceHistory]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'], paddingBottom: spacing['3'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.blue }]}>‹ Back</Text>
        </Pressable>
        <Text style={[typography.h2, { color: palette.textPrimary }]}>{Strings.safeSound.locationHistory}</Text>
        <View style={{ width: 40 }} />
      </View>

      {events.length === 0 && !isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['8'] }}>
          <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
            No location history recorded yet.
          </Text>
        </View>
      ) : (
        <FlashList
          data={events}
          keyExtractor={(item: SSLocationEvent) => item.eventId}
          estimatedItemSize={100}
          contentContainerStyle={{ paddingHorizontal: spacing['5'], paddingBottom: spacing['8'] }}
          renderItem={({ item }: { item: SSLocationEvent }) => (
            <Card style={{ marginBottom: spacing['3'] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>
                    {item.location.address ?? `${item.location.lat.toFixed(5)}, ${item.location.lng.toFixed(5)}`}
                  </Text>
                  <Text style={[typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
                    {formatTimestamp(item.recordedAt)} · {formatAccuracyMeters(item.location.accuracy)}
                  </Text>
                </View>
                <Badge label={SOURCE_LABEL[item.location.source] ?? item.location.source} tone="neutral" size="sm" />
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

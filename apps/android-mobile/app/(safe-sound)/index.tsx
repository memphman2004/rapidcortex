import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { DeviceCard } from '@/components/safe-sound/DeviceCard';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import type { SSDevice } from '@/types/mobile';

export default function SafeSoundDevicesScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string };

  const devices = useDevicesStore((state) => state.devices);
  const isLoading = useDevicesStore((state) => state.isLoading);
  const error = useDevicesStore((state) => state.error);
  const fetchDevices = useDevicesStore((state) => state.fetchDevices);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  }, [fetchDevices]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing['5'],
          paddingTop: spacing['4'],
          paddingBottom: spacing['3'],
        }}
      >
        <Text style={[typography.h1, { color: palette.textPrimary }]}>{Strings.safeSound.myDevices}</Text>
        <Pressable
          onPress={() => router.push('/(safe-sound)/add-device')}
          accessibilityLabel={Strings.safeSound.addDevice}
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.blue,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 24 }}>+</Text>
        </Pressable>
      </View>

      {error ? (
        <Text style={[typography.caption, { color: '#EF4444', paddingHorizontal: spacing['5'], marginBottom: spacing['2'] }]}>
          {error}
        </Text>
      ) : null}

      {devices.length === 0 && !isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['8'] }}>
          <Text style={{ fontSize: 48, marginBottom: spacing['4'] }}>📡</Text>
          <Text style={[typography.h2, { color: palette.textPrimary, textAlign: 'center' }]}>
            {Strings.safeSound.noDevicesTitle}
          </Text>
          <View style={{ marginTop: spacing['5'], width: '100%' }}>
            <Button
              title={Strings.safeSound.noDevicesAction}
              onPress={() => router.push('/(safe-sound)/add-device')}
            />
          </View>
        </View>
      ) : (
        <FlashList
          data={devices}
          keyExtractor={(item: SSDevice) => item.deviceId}
          estimatedItemSize={140}
          contentContainerStyle={{ paddingHorizontal: spacing['5'], paddingBottom: spacing['8'] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.blue} />}
          renderItem={({ item }: { item: SSDevice }) => (
            <DeviceCard device={item} onPress={() => router.push(`/(safe-sound)/device/${item.deviceId}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

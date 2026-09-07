import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

export default function AddDeviceScreen() {
  const router = useRouter();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const palette = colors as { background: string; surface: string; border: string; textPrimary: string; textSecondary: string; blue: string };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'], paddingBottom: spacing['3'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.blue }]}>‹ {Strings.common.cancel}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing['5'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['6'] }]}>
          {Strings.safeSound.addDevice}
        </Text>

        <Pressable
          onPress={() => router.push('/(safe-sound)/add-device/home-pair')}
          style={({ pressed }) => ({
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: borderRadius.xl,
            padding: spacing['6'],
            marginBottom: spacing['4'],
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: 32, marginBottom: spacing['3'] }}>🏠</Text>
          <Text style={[typography.h2, { color: palette.textPrimary }]}>{Strings.safeSound.addDeviceHome.title}</Text>
          <Text style={[typography.body, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
            {Strings.safeSound.addDeviceHome.description} · {Strings.safeSound.addDeviceHome.batteryLife}
          </Text>
          <Text style={[typography.h3, { color: palette.blue, marginTop: spacing['3'] }]}>
            {Strings.safeSound.addDeviceHome.price}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(safe-sound)/add-device/guardian-pair')}
          style={({ pressed }) => ({
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: borderRadius.xl,
            padding: spacing['6'],
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: 32, marginBottom: spacing['3'] }}>📍</Text>
          <Text style={[typography.h2, { color: palette.textPrimary }]}>{Strings.safeSound.addDeviceGuardian.title}</Text>
          <Text style={[typography.body, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
            {Strings.safeSound.addDeviceGuardian.description}
          </Text>
          <Text style={[typography.h3, { color: palette.blue, marginTop: spacing['3'] }]}>
            {Strings.safeSound.addDeviceGuardian.price}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

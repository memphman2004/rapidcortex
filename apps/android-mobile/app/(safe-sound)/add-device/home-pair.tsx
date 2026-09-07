import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import { bleErrorMessage, pairHomeDevice, scanForHomeDevices, type DiscoveredBleDevice } from '@/services/ble';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

type Step = 'intro' | 'scanning' | 'select' | 'naming' | 'pairing' | 'success' | 'error';

const MOUNT_TYPES: Array<keyof typeof Strings.safeSound.mountTypes> = [
  'keychain',
  'backpack',
  'collar',
  'luggage',
  'other',
];

function generateDeviceId(): string {
  const random = () => Math.floor(Math.random() * 16).toString(16);
  return `ss-${Date.now().toString(16)}-${Array.from({ length: 12 }, random).join('')}`;
}

export default function HomeDevicePairScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const addDevice = useDevicesStore((state) => state.addDevice);
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string; red: string };

  const [step, setStep] = useState<Step>('intro');
  const [discovered, setDiscovered] = useState<DiscoveredBleDevice[]>([]);
  const [selected, setSelected] = useState<DiscoveredBleDevice | null>(null);
  const [name, setName] = useState<string>(Strings.safeSound.pairing.defaultDeviceName);
  const [mountType, setMountType] = useState<keyof typeof Strings.safeSound.mountTypes>('keychain');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const startScan = async () => {
    setStep('scanning');
    setErrorMessage(null);
    setPermissionDenied(false);
    try {
      const found = await scanForHomeDevices();
      setDiscovered(found);
      if (found.length === 1) {
        setSelected(found[0]);
        setStep('naming');
      } else if (found.length > 1) {
        setStep('select');
      } else {
        setErrorMessage(Strings.safeSound.pairing.scanningTimeout);
        setStep('error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PAIRING_FAILED';
      if (message === 'PERMISSION_DENIED') {
        setPermissionDenied(true);
        setErrorMessage(Strings.safeSound.pairing.blePermissionDenied);
      } else {
        setErrorMessage(bleErrorMessage(message as never));
      }
      setStep('error');
    }
  };

  const handlePair = async () => {
    if (!selected) return;
    setStep('pairing');
    try {
      const deviceId = generateDeviceId();
      const result = await pairHomeDevice({
        bleDeviceId: selected.id,
        rcDeviceId: deviceId,
        ownerToken: user?.sub ?? deviceId,
      });

      if (!result.success) {
        setErrorMessage(bleErrorMessage(result.error ?? 'PAIRING_FAILED'));
        setStep('error');
        return;
      }

      await addDevice({
        deviceId,
        type: 'home',
        bleAddress: selected.id,
        name: name.trim() || Strings.safeSound.pairing.defaultDeviceName,
        mountType: Strings.safeSound.mountTypes[mountType],
      });

      setStep('success');
    } catch {
      setErrorMessage('Unable to pair device. Try again.');
      setStep('error');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.blue }]}>‹ {Strings.common.cancel}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing['5'], flexGrow: 1, justifyContent: 'center' }}>
        <Text style={[typography.h1, { color: palette.textPrimary, textAlign: 'center', marginBottom: spacing['6'] }]}>
          {Strings.safeSound.addDeviceHome.title}
        </Text>

        {step === 'intro' ? (
          <View style={{ alignItems: 'center', gap: spacing['5'] }}>
            <Text style={{ fontSize: 56 }}>🏠</Text>
            <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
              {Strings.safeSound.pairing.wakeDevice}
            </Text>
            <Button title={Strings.safeSound.pairing.deviceAwake} onPress={startScan} />
          </View>
        ) : null}

        {step === 'scanning' ? (
          <View style={{ alignItems: 'center', gap: spacing['4'] }}>
            <ActivityIndicator size="large" color={palette.blue} />
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.safeSound.pairing.scanning}</Text>
          </View>
        ) : null}

        {step === 'select' ? (
          <View style={{ gap: spacing['3'] }}>
            {discovered.map((device) => (
              <Card key={device.id} onPress={() => { setSelected(device); setStep('naming'); }}>
                <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{device.name}</Text>
                {device.rssi != null ? (
                  <Text style={[typography.caption, { color: palette.textSecondary }]}>Signal: {device.rssi} dBm</Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}

        {step === 'naming' ? (
          <View style={{ gap: spacing['4'] }}>
            <Input label={Strings.safeSound.pairing.nameDevice} value={name} onChangeText={setName} autoCapitalize="words" />
            <Text style={[typography.label, { color: palette.textPrimary }]}>Mount type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MOUNT_TYPES.map((key) => (
                <Pressable key={key} onPress={() => setMountType(key)}>
                  <Badge label={Strings.safeSound.mountTypes[key]} tone={mountType === key ? 'accent' : 'neutral'} />
                </Pressable>
              ))}
            </View>
            <Button title={Strings.common.confirm} onPress={handlePair} />
          </View>
        ) : null}

        {step === 'pairing' ? (
          <View style={{ alignItems: 'center', gap: spacing['4'] }}>
            <ActivityIndicator size="large" color={palette.blue} />
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.safeSound.pairing.pairing}</Text>
          </View>
        ) : null}

        {step === 'success' ? (
          <View style={{ alignItems: 'center', gap: spacing['5'] }}>
            <Text style={{ fontSize: 56 }}>✅</Text>
            <Text style={[typography.h2, { color: palette.textPrimary, textAlign: 'center' }]}>
              {Strings.safeSound.pairing.success(name)}
            </Text>
            <Button title={Strings.common.confirm} onPress={() => router.replace('/(safe-sound)')} />
          </View>
        ) : null}

        {step === 'error' ? (
          <View style={{ alignItems: 'center', gap: spacing['4'] }}>
            <Text style={{ fontSize: 48 }}>⚠️</Text>
            <Text style={[typography.body, { color: palette.red, textAlign: 'center' }]}>{errorMessage}</Text>
            {permissionDenied ? (
              <Button title={Strings.safeSound.pairing.bleOpenSettings} onPress={() => Linking.openSettings()} />
            ) : (
              <Button title={Strings.common.retry} onPress={startScan} />
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

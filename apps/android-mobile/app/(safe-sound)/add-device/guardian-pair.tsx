import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardField, StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import {
  createSubscription,
  getActivationStatus,
  isDevicesApiError,
  type ActivationStatus,
} from '@/services/api/devices';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

type Step = 'scan' | 'naming' | 'payment' | 'activating' | 'consent' | 'success' | 'error';

const MOUNT_TYPES: Array<keyof typeof Strings.safeSound.mountTypes> = ['wristband', 'backpack', 'collar', 'other'];

function generateDeviceId(): string {
  const random = () => Math.floor(Math.random() * 16).toString(16);
  return `gd-${Date.now().toString(16)}-${Array.from({ length: 12 }, random).join('')}`;
}

const ACTIVATION_MESSAGE: Record<ActivationStatus, string> = {
  pending: Strings.safeSound.guardianPairing.activating,
  activating_esim: Strings.safeSound.guardianPairing.activating,
  connecting_network: Strings.safeSound.guardianPairing.connecting,
  acquiring_location: Strings.safeSound.guardianPairing.gettingLocation,
  ready: Strings.safeSound.guardianPairing.ready,
  failed: 'Activation failed',
};

function GuardianPairContent() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string; red: string };

  const addDevice = useDevicesStore((state) => state.addDevice);
  const toggleRcCoreConsent = useDevicesStore((state) => state.toggleRcCoreConsent);

  const { createPaymentMethod, confirmPayment } = useStripe();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<Step>('scan');
  const [serial, setSerial] = useState<string | null>(null);
  const [name, setName] = useState('My Guardian');
  const [mountType, setMountType] = useState<keyof typeof Strings.safeSound.mountTypes>('wristband');
  const [cardComplete, setCardComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activationMessage, setActivationMessage] = useState<string>(Strings.safeSound.guardianPairing.activating);
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!permission || permission.granted) return;
    void requestPermission();
  }, [permission, requestPermission]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setSerial(data.trim());
    setStep('naming');
  };

  const handleRegisterAndPay = async () => {
    if (!serial) return;
    setErrorMessage(null);
    setProcessing(true);
    try {
      const newDeviceId = generateDeviceId();
      await addDevice({
        deviceId: newDeviceId,
        type: 'guardian',
        name: name.trim() || 'My Guardian',
        mountType: Strings.safeSound.mountTypes[mountType],
        serialNumber: serial,
      });
      setDeviceId(newDeviceId);

      const { paymentMethod, error: pmError } = await createPaymentMethod({ paymentMethodType: 'Card' });
      if (pmError || !paymentMethod) {
        throw new Error(pmError?.message ?? 'Unable to process card details');
      }

      const { clientSecret } = await createSubscription({
        deviceSerial: serial,
        paymentMethodId: paymentMethod.id,
      });

      if (clientSecret) {
        const { error: confirmError } = await confirmPayment(clientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: { paymentMethodId: paymentMethod.id },
        });
        if (confirmError) {
          throw new Error(confirmError.message ?? 'Payment failed');
        }
      }

      setStep('activating');
      pollActivation(serial);
    } catch (error) {
      setErrorMessage(isDevicesApiError(error) ?? (error instanceof Error ? error.message : 'Setup failed'));
      setStep('error');
    } finally {
      setProcessing(false);
    }
  };

  const pollActivation = (deviceSerial: string) => {
    const interval = setInterval(async () => {
      try {
        const result = await getActivationStatus(deviceSerial);
        setActivationMessage(ACTIVATION_MESSAGE[result.status] ?? result.message ?? '');
        if (result.status === 'ready') {
          clearInterval(interval);
          setStep('consent');
        } else if (result.status === 'failed') {
          clearInterval(interval);
          setErrorMessage(result.message ?? 'Activation failed');
          setStep('error');
        }
      } catch {
        clearInterval(interval);
        setErrorMessage('Unable to check activation status');
        setStep('error');
      }
    }, 2500);
  };

  const handleFinish = async () => {
    if (consentEnabled && deviceId) {
      try {
        await toggleRcCoreConsent(deviceId, true);
      } catch {
        // Consent can be enabled later from device detail if this fails.
      }
    }
    setStep('success');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.blue }]}>‹ {Strings.common.cancel}</Text>
        </Pressable>
      </View>

      {step === 'scan' ? (
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center', padding: spacing['5'] }]}>
            {Strings.safeSound.guardianPairing.scanQr}
          </Text>
          {permission?.granted ? (
            <CameraView
              style={{ flex: 1 }}
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['5'] }}>
              <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center', marginBottom: spacing['4'] }]}>
                Camera access is required to scan the Guardian QR code.
              </Text>
              <Button title="Open Settings" onPress={() => Linking.openSettings()} />
            </View>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing['5'], flexGrow: 1, justifyContent: 'center' }}>
          {step === 'naming' ? (
            <View style={{ gap: spacing['4'] }}>
              <Text style={[typography.h2, { color: palette.textPrimary }]}>Device found</Text>
              <Text style={[typography.caption, { color: palette.textSecondary }]}>Serial: {serial}</Text>
              <Input label={Strings.safeSound.pairing.nameDevice} value={name} onChangeText={setName} autoCapitalize="words" />
              <Text style={[typography.label, { color: palette.textPrimary }]}>Mount type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MOUNT_TYPES.map((key) => (
                  <Pressable key={key} onPress={() => setMountType(key)}>
                    <Badge label={Strings.safeSound.mountTypes[key]} tone={mountType === key ? 'accent' : 'neutral'} />
                  </Pressable>
                ))}
              </View>
              <Button title={Strings.common.confirm} onPress={() => setStep('payment')} />
            </View>
          ) : null}

          {step === 'payment' ? (
            <View style={{ gap: spacing['4'] }}>
              <Text style={[typography.h2, { color: palette.textPrimary }]}>
                {Strings.safeSound.guardianPairing.subscriptionTitle}
              </Text>
              <Text style={[typography.h1, { color: palette.blue }]}>{Strings.safeSound.guardianPairing.subscriptionPrice}</Text>
              <CardField
                postalCodeEnabled
                placeholders={{ number: '4242 4242 4242 4242' }}
                cardStyle={{ backgroundColor: '#FFFFFF', textColor: '#111827' }}
                style={{ width: '100%', height: 50 }}
                onCardChange={(details) => setCardComplete(details.complete)}
              />
              {errorMessage ? <Text style={[typography.caption, { color: palette.red }]}>{errorMessage}</Text> : null}
              <Button title="Subscribe & Pair" onPress={handleRegisterAndPay} disabled={!cardComplete} loading={processing} />
            </View>
          ) : null}

          {step === 'activating' ? (
            <View style={{ alignItems: 'center', gap: spacing['4'] }}>
              <ActivityIndicator size="large" color={palette.blue} />
              <Text style={[typography.body, { color: palette.textSecondary }]}>{activationMessage}</Text>
            </View>
          ) : null}

          {step === 'consent' ? (
            <View style={{ gap: spacing['4'] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[typography.bodyMedium, { color: palette.textPrimary, flex: 1, marginRight: 12 }]}>
                  {Strings.safeSound.rcCoreConsentTitle}
                </Text>
                <Switch value={consentEnabled} onValueChange={setConsentEnabled} trackColor={{ true: palette.blue }} />
              </View>
              <Text style={[typography.caption, { color: palette.textSecondary }]}>
                {Strings.safeSound.guardianPairing.rcCoreConsentExplain}
              </Text>
              <Button title={Strings.common.confirm} onPress={handleFinish} />
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
              <Button title={Strings.common.retry} onPress={() => setStep('payment')} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default function GuardianDevicePairScreen() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  return (
    <StripeProvider publishableKey={publishableKey} urlScheme="rapidcortex">
      <GuardianPairContent />
    </StripeProvider>
  );
}

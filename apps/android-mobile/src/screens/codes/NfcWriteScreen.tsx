import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { getCode } from '@/services/api/codes';
import { cancelNfcSession, isNFCSupported, nfcErrorMessage, writeURLToTag, type NFCWriteError } from '@/services/nfc';
import { useCodesStore } from '@/stores/codes.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import type { RCCode } from '@/types/mobile';

type Step = 'checking' | 'ready' | 'writing' | 'success' | 'error';

const ERROR_MESSAGE: Record<NFCWriteError, string> = {
  UNSUPPORTED: Strings.venue.nfcWrite.errors.unsupported,
  PERMISSION_DENIED: Strings.venue.nfcWrite.errors.permissionDenied,
  TIMEOUT: Strings.venue.nfcWrite.errors.timeout,
  TAG_INCOMPATIBLE: Strings.venue.nfcWrite.errors.tagIncompatible,
  WRITE_FAILED: Strings.venue.nfcWrite.errors.writeFailed,
  CANCELLED: Strings.venue.nfcWrite.errors.cancelled,
};

export default function NfcWriteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; amber: string; red: string; emerald: string };

  const recordNfcWrite = useCodesStore((state) => state.recordNfcWrite);

  const [code, setCode] = useState<RCCode | null>(null);
  const [step, setStep] = useState<Step>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bytesWritten, setBytesWritten] = useState(0);

  useEffect(() => {
    void getCode(id).then(setCode).catch(() => undefined);

    void isNFCSupported().then((supported) => {
      setStep(supported ? 'ready' : 'error');
      if (!supported) setErrorMessage(nfcErrorMessage('UNSUPPORTED'));
    });

    return () => {
      void cancelNfcSession();
    };
  }, [id]);

  const handleWrite = async () => {
    if (!code) return;
    setStep('writing');
    setErrorMessage(null);

    const result = await writeURLToTag(code.nfcUrl);
    if (!result.success) {
      setErrorMessage(nfcErrorMessage(result.error ?? 'WRITE_FAILED'));
      setStep('error');
      return;
    }

    setBytesWritten(result.bytesWritten ?? 0);

    try {
      await recordNfcWrite(code.codeId, {
        writtenBy: user?.sub ?? 'unknown',
        devicePlatform: Platform.OS === 'ios' ? 'ios' : 'android',
        writeMethod: 'native_nfc',
        bytesWritten: result.bytesWritten ?? 0,
        tagType: result.tagType,
      });
      setStep('success');
    } catch {
      setErrorMessage(Strings.common.somethingWentWrong);
      setStep('error');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.amber }]}>‹ {Strings.common.close}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing['5'], flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['6'], textAlign: 'center' }]}>
          {Strings.venue.signPackage.programNfc}
        </Text>

        {step === 'checking' ? <ActivityIndicator size="large" color={palette.amber} /> : null}

        {step === 'ready' ? (
          <View style={{ alignItems: 'center', gap: spacing['5'] }}>
            <Text style={{ fontSize: 64 }}>📶</Text>
            <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
              {Strings.venue.nfcWrite.ready}
            </Text>
            <Button title={Strings.venue.signPackage.programNfc} onPress={handleWrite} disabled={!code} />
          </View>
        ) : null}

        {step === 'writing' ? (
          <View style={{ alignItems: 'center', gap: spacing['4'] }}>
            <ActivityIndicator size="large" color={palette.amber} />
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.venue.nfcWrite.writing}</Text>
          </View>
        ) : null}

        {step === 'success' ? (
          <View style={{ alignItems: 'center', gap: spacing['5'] }}>
            <Text style={{ fontSize: 64 }}>✅</Text>
            <Text style={[typography.h2, { color: palette.textPrimary, textAlign: 'center' }]}>
              {Strings.venue.nfcWrite.success}
            </Text>
            <Text style={[typography.caption, { color: palette.textSecondary }]}>{bytesWritten} bytes written</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title={Strings.venue.nfcWrite.writeAnother} variant="secondary" onPress={() => setStep('ready')} />
              <Button title={Strings.common.close} onPress={() => router.back()} />
            </View>
          </View>
        ) : null}

        {step === 'error' ? (
          <View style={{ alignItems: 'center', gap: spacing['4'] }}>
            <Text style={{ fontSize: 48 }}>⚠️</Text>
            <Text style={[typography.body, { color: palette.red, textAlign: 'center' }]}>{errorMessage}</Text>
            <Button title={Strings.common.retry} onPress={() => setStep('ready')} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

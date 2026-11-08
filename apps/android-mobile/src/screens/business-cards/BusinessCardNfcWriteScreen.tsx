import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { isBusinessCardNfcUrl } from '@/lib/business-card-nfc';
import { useFieldProduct } from '@/navigation/field-product';
import {
  getNfcCard,
  setNfcCardStatus,
  type BusinessCardNfcCard,
} from '@/services/api/business-cards';
import {
  cancelNfcSession,
  isNFCSupported,
  nfcErrorMessage,
  writeURLToTag,
  type NFCWriteError,
} from '@/services/nfc';
import { useTheme } from '@/theme';
import { canManageBusinessCardNfc } from '@/utils/roles';
import { Strings } from '@/utils/strings';

type Step = 'checking' | 'ready' | 'writing' | 'success' | 'error';

const ERROR_MESSAGE: Record<NFCWriteError, string> = {
  UNSUPPORTED: Strings.venue.nfcWrite.errors.unsupported,
  PERMISSION_DENIED: Strings.venue.nfcWrite.errors.permissionDenied,
  TIMEOUT: Strings.venue.nfcWrite.errors.timeout,
  TAG_INCOMPATIBLE: Strings.venue.nfcWrite.errors.tagIncompatible,
  WRITE_FAILED: Strings.venue.nfcWrite.errors.writeFailed,
  CANCELLED: Strings.venue.nfcWrite.errors.cancelled,
};

export default function BusinessCardNfcWriteScreen() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const router = useRouter();
  const { href } = useFieldProduct();
  const { role } = useAuth();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    background: string;
    textPrimary: string;
    textSecondary: string;
    amber: string;
    red: string;
    emerald: string;
  };

  const [card, setCard] = useState<BusinessCardNfcCard | null>(null);
  const [step, setStep] = useState<Step>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bytesWritten, setBytesWritten] = useState(0);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [statusNoteOk, setStatusNoteOk] = useState(true);

  useEffect(() => {
    if (!cardId) {
      setErrorMessage(Strings.businessCards.missingCard);
      setStep('error');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [supported, loaded] = await Promise.all([isNFCSupported(), getNfcCard(cardId)]);
        if (cancelled) return;
        setCard(loaded);
        if (!supported) {
          setErrorMessage(nfcErrorMessage('UNSUPPORTED'));
          setStep('error');
          return;
        }
        if (loaded.status === 'revoked') {
          setErrorMessage(Strings.businessCards.revoked);
          setStep('error');
          return;
        }
        if (!isBusinessCardNfcUrl(loaded.permanentUrl)) {
          setErrorMessage(Strings.businessCards.invalidUrl);
          setStep('error');
          return;
        }
        setStep('ready');
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : Strings.common.somethingWentWrong);
        setStep('error');
      }
    })();

    return () => {
      cancelled = true;
      void cancelNfcSession();
    };
  }, [cardId]);

  if (!canManageBusinessCardNfc(role)) {
    return <Redirect href={href('/') as never} />;
  }

  const handleWrite = async () => {
    if (!card) return;
    setStep('writing');
    setErrorMessage(null);
    setStatusNote(null);
    setStatusNoteOk(true);

    const result = await writeURLToTag(card.permanentUrl);
    if (!result.success) {
      setErrorMessage(nfcErrorMessage(result.error ?? 'WRITE_FAILED'));
      setStep('error');
      return;
    }

    setBytesWritten(result.bytesWritten ?? 0);

    try {
      const updated = await setNfcCardStatus(card.cardId, 'programmed', card.version);
      setCard(updated);
      setStatusNoteOk(true);
      setStatusNote(Strings.businessCards.markedProgrammed);
      setStep('success');
    } catch (err) {
      setStatusNoteOk(false);
      setStatusNote(
        err instanceof Error ? err.message : Strings.businessCards.markProgrammedFailed,
      );
      setStep('success');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing['5'],
          paddingTop: spacing['4'],
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[typography.h3, { color: palette.amber }]}>‹ {Strings.common.close}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing['5'],
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          style={[
            typography.h1,
            { color: palette.textPrimary, marginBottom: spacing['4'], textAlign: 'center' },
          ]}
        >
          {Strings.businessCards.programNfc}
        </Text>

        {card ? (
          <Text
            style={[
              typography.caption,
              {
                color: palette.textSecondary,
                textAlign: 'center',
                marginBottom: spacing['6'],
              },
            ]}
            numberOfLines={3}
          >
            {card.permanentUrl}
          </Text>
        ) : null}

        {step === 'checking' ? <ActivityIndicator size="large" color={palette.amber} /> : null}

        {step === 'ready' ? (
          <View style={{ alignItems: 'center', gap: spacing['5'] }}>
            <Text style={{ fontSize: 64 }}>📶</Text>
            <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
              {Strings.businessCards.ready}
            </Text>
            <Button
              title={Strings.businessCards.programNfc}
              onPress={() => void handleWrite()}
              disabled={!card}
            />
          </View>
        ) : null}

        {step === 'writing' ? (
          <View style={{ alignItems: 'center', gap: spacing['4'] }}>
            <ActivityIndicator size="large" color={palette.amber} />
            <Text style={[typography.body, { color: palette.textSecondary }]}>
              {Strings.businessCards.writing}
            </Text>
          </View>
        ) : null}

        {step === 'success' ? (
          <View style={{ alignItems: 'center', gap: spacing['5'] }}>
            <Text style={{ fontSize: 64 }}>✅</Text>
            <Text style={[typography.h2, { color: palette.textPrimary, textAlign: 'center' }]}>
              {Strings.businessCards.success}
            </Text>
            <Text style={[typography.caption, { color: palette.textSecondary }]}>
              {bytesWritten} bytes written
            </Text>
            {statusNote ? (
              <Text
                style={[
                  typography.caption,
                  {
                    color: statusNoteOk ? palette.emerald : palette.red,
                    textAlign: 'center',
                  },
                ]}
              >
                {statusNote}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title={Strings.venue.nfcWrite.writeAnother}
                variant="secondary"
                onPress={() => setStep('ready')}
              />
              <Button title={Strings.common.close} onPress={() => router.back()} />
            </View>
          </View>
        ) : null}

        {step === 'error' ? (
          <View style={{ alignItems: 'center', gap: spacing['4'] }}>
            <Text style={{ fontSize: 48 }}>⚠️</Text>
            <Text style={[typography.body, { color: palette.red, textAlign: 'center' }]}>
              {errorMessage}
            </Text>
            {card && card.status !== 'revoked' ? (
              <Button title={Strings.common.retry} onPress={() => setStep('ready')} />
            ) : (
              <Button title={Strings.common.close} onPress={() => router.back()} />
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

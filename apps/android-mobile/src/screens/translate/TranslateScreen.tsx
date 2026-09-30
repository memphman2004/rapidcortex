import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useTranslateLiveSession } from '@/hooks/useTranslateLiveSession';
import { useFieldProduct } from '@/navigation/field-product';
import {
  fetchTranslateLanguages,
  type TranslateLanguage,
} from '@/services/api/translate';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

const FALLBACK_LANGUAGES: TranslateLanguage[] = [
  { code: 'es', label: 'Spanish' },
  { code: 'zh-CN', label: 'Mandarin (Chinese)' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ht', label: 'Haitian Creole' },
];

function TranslateScreenContent() {
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    background: string;
    textPrimary: string;
    textSecondary: string;
    amber: string;
    border: string;
    surface: string;
  };
  const { agencyId } = useAuth();
  const { product } = useFieldProduct();
  const title =
    product === 'campus' ? Strings.campus.translate : Strings.venue.translate;
  const staffLabel = 'Staff';
  const subjectLabel = product === 'campus' ? 'Individual' : 'Guest';

  const [languages, setLanguages] = useState<TranslateLanguage[]>(FALLBACK_LANGUAGES);
  const [subjectLanguage, setSubjectLanguage] = useState('es');
  const tx = useTranslateLiveSession();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchTranslateLanguages();
        if (!cancelled && res.languages?.length) {
          setLanguages(res.languages.map((l) => ({ code: l.code, label: l.label })));
        }
      } catch {
        // keep fallback list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const vertical = product === 'campus' ? 'campus' : 'venue';
  const codeLabel = useMemo(() => agencyId || product, [agencyId, product]);
  const active =
    tx.session && tx.session.status !== 'CLOSED' && tx.session.status !== 'EXPIRED';

  const handleStart = async () => {
    if (!agencyId) {
      Alert.alert(Strings.common.somethingWentWrong, 'Missing agency context');
      return;
    }
    const body =
      vertical === 'campus'
        ? {
            subjectLanguage,
            vertical: 'campus' as const,
            campusContext: { campusCode: codeLabel },
          }
        : {
            subjectLanguage,
            vertical: 'venue' as const,
            venueContext: { venueCode: codeLabel },
          };
    await tx.start(body);
  };

  const handleClose = async (writebackNote: boolean) => {
    await tx.close(writebackNote);
    Alert.alert(
      'Session ended',
      writebackNote
        ? 'Language assistance saved for reporting.'
        : 'Session closed and counted for annual assistance totals.',
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['2'] }]}>
          {title}
        </Text>
        <Text
          style={[
            typography.body,
            { color: palette.textSecondary, marginBottom: spacing['5'] },
          ]}
        >
          Speak to translate. Speech is recognized live; the translation plays back as voice.
        </Text>

        {!active ? (
          <Card style={{ marginBottom: spacing['4'] }}>
            <Text
              style={[
                typography.label,
                { color: palette.textSecondary, marginBottom: spacing['3'] },
              ]}
            >
              Subject language
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: spacing['4'],
              }}
            >
              {languages.map((lang) => {
                const selected = lang.code === subjectLanguage;
                return (
                  <Pressable
                    key={lang.code}
                    onPress={() => setSubjectLanguage(lang.code)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: selected ? palette.amber : palette.border,
                      backgroundColor: selected ? `${palette.amber}22` : palette.surface,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? palette.amber : palette.textPrimary,
                        fontSize: 13,
                        fontWeight: selected ? '600' : '400',
                      }}
                    >
                      {lang.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Button
              title={tx.starting ? 'Starting…' : 'Start session'}
              onPress={() => void handleStart()}
              disabled={tx.starting}
              loading={tx.starting}
            />
          </Card>
        ) : (
          <Card style={{ marginBottom: spacing['4'] }}>
            <Text style={[typography.h3, { color: palette.textPrimary }]}>
              Session {tx.connected ? 'live' : 'connecting…'}
            </Text>
            <Text style={[typography.body, { color: palette.textSecondary, marginTop: 6 }]}>
              {(tx.session?.subjectLanguage ?? subjectLanguage).toUpperCase()} ↔ EN ·{' '}
              {tx.session?.status} · {tx.session?.segmentCount ?? 0} exchanges
            </Text>
            <Text
              style={[
                typography.label,
                {
                  color: tx.listening ? palette.amber : palette.textSecondary,
                  marginTop: spacing['3'],
                },
              ]}
            >
              {tx.listening
                ? `Listening as ${tx.speaker === 'officer' ? staffLabel : subjectLabel}…`
                : 'Mic idle — tap a speaker, then speak'}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing['4'] }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={staffLabel}
                  variant={tx.speaker === 'officer' && !tx.listening ? 'primary' : 'secondary'}
                  onPress={() => void tx.startMic('officer')}
                  disabled={tx.listening}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={subjectLabel}
                  variant={tx.speaker === 'subject' && !tx.listening ? 'primary' : 'secondary'}
                  onPress={() => void tx.startMic('subject')}
                  disabled={tx.listening}
                />
              </View>
            </View>

            {tx.listening ? (
              <View style={{ marginTop: spacing['3'] }}>
                <Button title="Stop listening" onPress={tx.stopMic} variant="danger" />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing['4'] }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="End"
                  onPress={() => void handleClose(false)}
                  variant="secondary"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="End + note" onPress={() => void handleClose(true)} />
              </View>
            </View>
          </Card>
        )}

        {tx.error ? (
          <Text style={{ color: '#f87171', marginBottom: spacing['3'] }}>{tx.error}</Text>
        ) : null}

        <Text
          style={[
            typography.label,
            { color: palette.textSecondary, marginBottom: spacing['2'] },
          ]}
        >
          Live captions
        </Text>
        {tx.feed.length === 0 ? (
          <Text style={[typography.body, { color: palette.textSecondary }]}>
            {active
              ? 'Tap Staff or Guest/Individual and speak. Translation audio plays automatically.'
              : 'Start a session to begin speech translation.'}
          </Text>
        ) : (
          tx.feed.map((seg) => (
            <Card key={seg.segmentId} style={{ marginBottom: spacing['2'] }}>
              <Text style={[typography.label, { color: palette.amber }]}>
                {seg.speaker === 'officer' ? staffLabel : subjectLabel}
                {seg.isFinal ? '' : ' · …'}
              </Text>
              <Text style={[typography.body, { color: palette.textPrimary, marginTop: 4 }]}>
                {seg.originalText}
              </Text>
              {seg.translatedText ? (
                <Text
                  style={[typography.body, { color: palette.textSecondary, marginTop: 4 }]}
                >
                  {seg.translatedText}
                </Text>
              ) : null}
              {seg.audioUrl ? (
                <Text
                  style={[
                    typography.label,
                    { color: palette.textSecondary, marginTop: 6, fontSize: 11 },
                  ]}
                >
                  TTS played
                </Text>
              ) : null}
            </Card>
          ))
        )}

        {tx.starting ? (
          <ActivityIndicator color={palette.amber} style={{ marginTop: spacing['4'] }} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function TranslateScreen() {
  return (
    <ScreenErrorBoundary>
      <TranslateScreenContent />
    </ScreenErrorBoundary>
  );
}

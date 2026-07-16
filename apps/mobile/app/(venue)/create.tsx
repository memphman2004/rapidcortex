import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import { useCodesStore } from '@/stores/codes.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import { normalizePhoneToE164, validateRequired } from '@/utils/validation';
import type { CodeVertical, ReportType } from '@/types/mobile';

const REPORT_TYPES: ReportType[] = ['anonymous', 'identified', 'both'];

export default function VenueCreateCodeScreen() {
  const router = useRouter();
  const { agencyId, vertical } = useAuth();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; amber: string; red: string };
  const createNewCode = useCodesStore((state) => state.createNewCode);

  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [reportType, setReportType] = useState<ReportType>('both');
  const [smsNumber, setSmsNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resolvedVertical: CodeVertical = vertical?.toLowerCase().includes('campus') ? 'campus' : 'venue';

  const handleCreate = async () => {
    setError(null);
    const nameResult = validateRequired(name, Strings.venue.createCode.codeName);
    if (!nameResult.valid) return setError(nameResult.error ?? null);
    const zoneResult = validateRequired(zone, Strings.venue.createCode.zone);
    if (!zoneResult.valid) return setError(zoneResult.error ?? null);

    let normalizedSms: string | null = null;
    if (smsNumber.trim()) {
      normalizedSms = normalizePhoneToE164(smsNumber);
      if (!normalizedSms) {
        setError('Enter a valid SMS phone number.');
        return;
      }
    }

    if (!agencyId) {
      setError('Missing agency context. Sign in again.');
      return;
    }

    setSaving(true);
    try {
      const code = await createNewCode({
        agencyId,
        name,
        zone,
        reportType,
        vertical: resolvedVertical,
        smsNumber: normalizedSms,
      });
      setName('');
      setZone('');
      setSmsNumber('');
      setReportType('both');
      Alert.alert(Strings.venue.createCode.successToast, undefined, [
        {
          text: Strings.venue.signPackage.programNfc,
          onPress: () => router.push(`/(venue)/code/${code.codeId}/nfc-write`),
        },
        {
          text: Strings.venue.signPackage.qrCode,
          onPress: () => router.push(`/(venue)/code/${code.codeId}`),
        },
      ]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : Strings.common.somethingWentWrong);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['5'] }]}>
            {Strings.venue.createCode.createButton}
          </Text>

          <View style={{ gap: spacing['4'] }}>
            <Input
              label={Strings.venue.createCode.codeName}
              value={name}
              onChangeText={setName}
              placeholder={Strings.venue.createCode.codeNamePlaceholder}
              autoCapitalize="words"
            />
            <Input
              label={Strings.venue.createCode.zone}
              value={zone}
              onChangeText={setZone}
              placeholder={Strings.venue.createCode.zonePlaceholder}
              autoCapitalize="words"
            />

            <View>
              <Text style={[typography.label, { color: palette.textPrimary, marginBottom: spacing['2'] }]}>
                {Strings.venue.createCode.reportType}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {REPORT_TYPES.map((type) => (
                  <Text key={type} onPress={() => setReportType(type)}>
                    <Badge
                      label={Strings.venue.createCode.reportTypes[type]}
                      tone={reportType === type ? 'accent' : 'neutral'}
                    />
                  </Text>
                ))}
              </View>
            </View>

            <Input
              label={Strings.venue.createCode.smsNumber}
              value={smsNumber}
              onChangeText={setSmsNumber}
              placeholder={Strings.venue.createCode.smsPlaceholder}
              keyboardType="phone-pad"
              helperText={Strings.venue.createCode.smsHelper}
            />

            {error ? <Text style={[typography.caption, { color: palette.red }]}>{error}</Text> : null}

            <Button title={Strings.venue.createCode.createButton} onPress={handleCreate} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

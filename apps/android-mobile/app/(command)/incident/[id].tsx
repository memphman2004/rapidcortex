import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/common/Card';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { getCommandIncident, getCommandTranscript, type CommandIncident } from '@/services/api/command';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

function IncidentDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string };
  const [incident, setIncident] = useState<CommandIncident | null>(null);
  const [transcript, setTranscript] = useState<Array<{ sequence: number; speaker: string; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [inc, tr] = await Promise.all([getCommandIncident(id), getCommandTranscript(id)]);
      setIncident(inc.incident);
      setTranscript(tr.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : Strings.common.somethingWentWrong);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[typography.label, { color: palette.blue, marginBottom: spacing['4'] }]}>← Home</Text>
        </Pressable>
        {error ? (
          <Text style={[typography.caption, { color: '#EF4444' }]}>{error}</Text>
        ) : null}
        <Text style={[typography.h1, { color: palette.textPrimary }]}>
          {incident?.title || id}
        </Text>
        <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
          {[incident?.status, incident?.urgency, incident?.location].filter(Boolean).join(' · ')}
        </Text>
        {incident?.summary ? (
          <Card style={{ marginTop: spacing['4'] }}>
            <Text style={[typography.body, { color: palette.textPrimary }]}>{incident.summary}</Text>
          </Card>
        ) : null}
        <Text style={[typography.label, { color: palette.textSecondary, marginTop: spacing['6'], marginBottom: spacing['2'] }]}>
          TRANSCRIPT
        </Text>
        {transcript.length === 0 ? (
          <Text style={[typography.body, { color: palette.textSecondary }]}>—</Text>
        ) : (
          transcript.map((row) => (
            <View key={row.sequence} style={{ marginBottom: spacing['3'] }}>
              <Text style={[typography.caption, { color: palette.blue }]}>{row.speaker}</Text>
              <Text style={[typography.body, { color: palette.textPrimary, marginTop: 2 }]}>{row.text}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function CommandIncidentScreen() {
  return (
    <ScreenErrorBoundary>
      <IncidentDetailContent />
    </ScreenErrorBoundary>
  );
}

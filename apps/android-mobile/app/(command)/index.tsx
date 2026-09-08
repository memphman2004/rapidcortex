import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/common/Card';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { getCommandHome, type CommandHome, type CommandIncident } from '@/services/api/command';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

function IncidentRow({
  item,
  onPress,
}: {
  item: CommandIncident;
  onPress: () => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { textPrimary: string; textSecondary: string; amber: string; border: string };
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={{ marginBottom: spacing['2'] }}>
        <Text style={[typography.h3, { color: palette.textPrimary }]}>{item.title || item.incidentId}</Text>
        <Text style={[typography.caption, { color: palette.textSecondary, marginTop: 4 }]}>
          {[item.status, item.urgency, item.location].filter(Boolean).join(' · ') || '—'}
        </Text>
      </Card>
    </Pressable>
  );
}

function CommandHomeContent() {
  const router = useRouter();
  const { agencyId } = useAuth();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string };
  const [home, setHome] = useState<CommandHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getCommandHome(agencyId || undefined);
      setHome(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : Strings.common.somethingWentWrong);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const stats = home?.stats ?? { activeCalls: 0, queue: 0, onlineCount: 0 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <Text style={[typography.h1, { color: palette.textPrimary }]}>{Strings.command.home}</Text>
        <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
          {Strings.command.notDispatch}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing['5'], marginBottom: spacing['5'] }}>
          {[
            [Strings.command.activeCalls, stats.activeCalls],
            [Strings.command.queue, stats.queue],
            [Strings.command.online, stats.onlineCount],
          ].map(([label, value]) => (
            <Card key={String(label)} style={{ flex: 1 }}>
              <Text style={[typography.h1, { color: palette.textPrimary }]}>{value}</Text>
              <Text style={[typography.caption, { color: palette.textSecondary, marginTop: 4 }]}>{label}</Text>
            </Card>
          ))}
        </View>

        {error ? (
          <Text style={[typography.caption, { color: '#EF4444', marginBottom: spacing['3'] }]}>{error}</Text>
        ) : null}

        {(home?.assistRequests.length ?? 0) > 0 ? (
          <View style={{ marginBottom: spacing['5'] }}>
            <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
              {Strings.command.assist.toUpperCase()}
            </Text>
            {home?.assistRequests.map((item) => (
              <IncidentRow
                key={item.incidentId}
                item={item}
                onPress={() => router.push(`/(command)/incident/${item.incidentId}`)}
              />
            ))}
          </View>
        ) : null}

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          {Strings.command.incidents.toUpperCase()}
        </Text>
        {(home?.incidents.length ?? 0) === 0 ? (
          <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.command.empty}</Text>
        ) : (
          home?.incidents.map((item) => (
            <IncidentRow
              key={item.incidentId}
              item={item}
              onPress={() => router.push(`/(command)/incident/${item.incidentId}`)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function CommandHomeScreen() {
  return (
    <ScreenErrorBoundary>
      <CommandHomeContent />
    </ScreenErrorBoundary>
  );
}

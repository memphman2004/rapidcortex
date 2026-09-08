import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/common/Card';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { getCommandStaff, type CommandStaffRow } from '@/services/api/command';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

function CommandStaffContent() {
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string };
  const [items, setItems] = useState<CommandStaffRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getCommandStaff();
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : Strings.common.somethingWentWrong);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['4'] }]}>
          {Strings.command.staff}
        </Text>
        {error ? (
          <Text style={[typography.caption, { color: '#EF4444' }]}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.command.staffEmpty}</Text>
        ) : (
          items.map((row) => (
            <Card key={row.userId} style={{ marginBottom: spacing['2'] }}>
              <Text style={[typography.h3, { color: palette.textPrimary }]}>{row.displayName}</Text>
              <View style={{ marginTop: 4 }}>
                <Text style={[typography.caption, { color: palette.textSecondary }]}>
                  {row.position || row.role} · {row.status}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function CommandStaffScreen() {
  return (
    <ScreenErrorBoundary>
      <CommandStaffContent />
    </ScreenErrorBoundary>
  );
}

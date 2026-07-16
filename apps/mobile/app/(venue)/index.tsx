import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Input } from '@/components/common/Input';
import { CodeCard } from '@/components/venue/CodeCard';
import { useAuth } from '@/hooks/useAuth';
import { useCodesStore, type CodesStatusFilter } from '@/stores/codes.store';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

const STATUS_FILTERS: Array<{ key: CodesStatusFilter; label: string }> = [
  { key: 'all', label: Strings.venue.filters.all },
  { key: 'active', label: Strings.venue.filters.active },
  { key: 'inactive', label: Strings.venue.filters.inactive },
  { key: 'nfcWritten', label: Strings.venue.filters.nfcWritten },
  { key: 'notWritten', label: Strings.venue.filters.notWritten },
];

export default function VenueCodesScreen() {
  const router = useRouter();
  const { agencyId } = useAuth();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; amber: string };

  const isLoading = useCodesStore((state) => state.isLoading);
  const error = useCodesStore((state) => state.error);
  const search = useCodesStore((state) => state.search);
  const statusFilter = useCodesStore((state) => state.statusFilter);
  const fetchCodes = useCodesStore((state) => state.fetchCodes);
  const setSearch = useCodesStore((state) => state.setSearch);
  const setStatusFilter = useCodesStore((state) => state.setStatusFilter);
  const filteredCodes = useCodesStore((state) => state.getFilteredCodes());

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (agencyId) void fetchCodes(agencyId);
  }, [agencyId, fetchCodes]);

  const onRefresh = useCallback(async () => {
    if (!agencyId) return;
    setRefreshing(true);
    await fetchCodes(agencyId);
    setRefreshing(false);
  }, [agencyId, fetchCodes]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing['5'], paddingTop: spacing['4'], paddingBottom: spacing['3'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['4'] }]}>
          {Strings.venue.agencyCodes}
        </Text>
        <Input value={search} onChangeText={setSearch} placeholder={Strings.venue.searchPlaceholder} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing['3'] }}>
          {STATUS_FILTERS.map((filter) => (
            <Pressable key={filter.key} onPress={() => setStatusFilter(filter.key)}>
              <Badge
                label={filter.label}
                tone={(statusFilter === filter.key ? 'accent' : 'neutral') as BadgeTone}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {error ? (
        <Text style={[typography.caption, { color: '#EF4444', paddingHorizontal: spacing['5'], marginBottom: spacing['2'] }]}>
          {error}
        </Text>
      ) : null}

      {filteredCodes.length === 0 && !isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['8'] }}>
          <Text style={{ fontSize: 48, marginBottom: spacing['4'] }}>🏷️</Text>
          <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
            No codes match your filters yet.
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredCodes}
          keyExtractor={(item) => item.codeId}
          estimatedItemSize={150}
          contentContainerStyle={{ paddingHorizontal: spacing['5'], paddingBottom: spacing['8'] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.amber} />}
          renderItem={({ item }) => (
            <CodeCard code={item} onPress={() => router.push(`/(venue)/code/${item.codeId}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

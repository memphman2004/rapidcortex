import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Input } from '@/components/common/Input';
import { CodeCard } from '@/components/venue/CodeCard';
import { useAuth } from '@/hooks/useAuth';
import { useFieldProduct } from '@/navigation/field-product';
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

export default function CodesListScreen() {
  const router = useRouter();
  const { href, vertical } = useFieldProduct();
  const { agencyId } = useAuth();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    background: string;
    textPrimary: string;
    textSecondary: string;
    amber: string;
  };

  const isLoading = useCodesStore((state) => state.isLoading);
  const error = useCodesStore((state) => state.error);
  const codes = useCodesStore((state) => state.codes);
  const search = useCodesStore((state) => state.search);
  const statusFilter = useCodesStore((state) => state.statusFilter);
  const verticalFilter = useCodesStore((state) => state.verticalFilter);
  const fetchCodes = useCodesStore((state) => state.fetchCodes);
  const setSearch = useCodesStore((state) => state.setSearch);
  const setStatusFilter = useCodesStore((state) => state.setStatusFilter);
  const setVerticalFilter = useCodesStore((state) => state.setVerticalFilter);

  const filteredCodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return codes.filter((code) => {
      if (verticalFilter !== 'all' && code.vertical !== verticalFilter) return false;
      if (statusFilter === 'active' && code.status !== 'active') return false;
      if (statusFilter === 'inactive' && code.status !== 'inactive') return false;
      if (statusFilter === 'nfcWritten' && code.nfcWriteLog.length === 0) return false;
      if (statusFilter === 'notWritten' && code.nfcWriteLog.length > 0) return false;
      if (!query) return true;
      return (
        code.name.toLowerCase().includes(query) ||
        code.zone.toLowerCase().includes(query)
      );
    });
  }, [codes, search, statusFilter, verticalFilter]);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setVerticalFilter(vertical);
  }, [vertical, setVerticalFilter]);

  useEffect(() => {
    if (agencyId) void fetchCodes(agencyId);
  }, [agencyId, fetchCodes]);

  const onRefresh = useCallback(async () => {
    if (!agencyId) return;
    setRefreshing(true);
    try {
      await fetchCodes(agencyId);
    } finally {
      setRefreshing(false);
    }
  }, [agencyId, fetchCodes]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View
        style={{
          paddingHorizontal: spacing['5'],
          paddingTop: spacing['4'],
          paddingBottom: spacing['3'],
        }}
      >
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['4'] }]}>
          {Strings.venue.agencyCodes}
        </Text>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder={Strings.venue.searchPlaceholder}
        />
        <Text
          style={[
            typography.caption,
            { color: palette.textSecondary, marginTop: spacing['2'] },
          ]}
        >
          Tap a code for QR details, or Program NFC Tag on the card.
        </Text>

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
        <Text
          style={[
            typography.caption,
            {
              color: '#EF4444',
              paddingHorizontal: spacing['5'],
              marginBottom: spacing['2'],
            },
          ]}
        >
          {error}
        </Text>
      ) : null}

      {!agencyId ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing['8'],
          }}
        >
          <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>
            Your account is missing an agency assignment. Contact your admin.
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filteredCodes}
          keyExtractor={(item) => item.codeId}
          contentContainerStyle={{
            paddingHorizontal: spacing['5'],
            paddingBottom: spacing['8'],
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={palette.amber}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: spacing['12'],
                  paddingHorizontal: spacing['8'],
                }}
              >
                <Text style={{ fontSize: 48, marginBottom: spacing['4'] }}>🏷️</Text>
                <Text
                  style={[
                    typography.body,
                    { color: palette.textSecondary, textAlign: 'center' },
                  ]}
                >
                  No codes match your filters yet.
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  typography.caption,
                  {
                    color: palette.textSecondary,
                    textAlign: 'center',
                    marginTop: spacing['8'],
                  },
                ]}
              >
                {Strings.common.loading}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <CodeCard
              code={item}
              onPress={() => router.push(href(`/code/${item.codeId}`) as never)}
              onProgramNfc={() =>
                router.push(href(`/code/${item.codeId}/nfc-write`) as never)
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

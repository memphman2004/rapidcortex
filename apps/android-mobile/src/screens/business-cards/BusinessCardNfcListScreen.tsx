import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { useAuth } from '@/hooks/useAuth';
import { shortCardId } from '@/lib/business-card-nfc';
import { useFieldProduct } from '@/navigation/field-product';
import {
  listBusinessCardProfiles,
  listNfcCards,
  type BusinessCardNfcCard,
} from '@/services/api/business-cards';
import { useTheme } from '@/theme';
import { canManageBusinessCardNfc } from '@/utils/roles';
import { Strings } from '@/utils/strings';

function statusTone(status: string): BadgeTone {
  if (status === 'programmed' || status === 'verified') return 'success';
  if (status === 'assigned') return 'accent';
  if (status === 'revoked') return 'danger';
  return 'neutral';
}

export default function BusinessCardNfcListScreen() {
  const router = useRouter();
  const { href } = useFieldProduct();
  const { role } = useAuth();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    background: string;
    textPrimary: string;
    textSecondary: string;
    amber: string;
    border: string;
    surface: string;
  };

  const [cards, setCards] = useState<BusinessCardNfcCard[]>([]);
  const [namesByProfile, setNamesByProfile] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [nfcCards, profiles] = await Promise.all([
      listNfcCards(),
      listBusinessCardProfiles().catch(() => []),
    ]);
    setCards(nfcCards);
    const map: Record<string, string> = {};
    for (const profile of profiles) {
      map[profile.profileId] = profile.displayName;
    }
    setNamesByProfile(map);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : Strings.common.somethingWentWrong);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : Strings.common.somethingWentWrong);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const writable = useMemo(
    () => cards.filter((card) => card.status !== 'revoked'),
    [cards],
  );

  if (!canManageBusinessCardNfc(role)) {
    return <Redirect href={href('/') as never} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View
        style={{
          paddingHorizontal: spacing['5'],
          paddingTop: spacing['4'],
          paddingBottom: spacing['3'],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[typography.h3, { color: palette.amber }]}>‹ {Strings.common.close}</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing['5'], marginBottom: spacing['3'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary }]}>
          {Strings.businessCards.nfcListTitle}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: palette.textSecondary, marginTop: spacing['2'] },
          ]}
        >
          {Strings.businessCards.nfcListBlurb}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={palette.amber} style={{ marginTop: spacing['8'] }} />
      ) : null}

      {error ? (
        <Text
          style={[
            typography.caption,
            { color: '#EF4444', paddingHorizontal: spacing['5'], marginBottom: spacing['2'] },
          ]}
        >
          {error}
        </Text>
      ) : null}

      {!loading ? (
        <FlatList
          data={writable}
          keyExtractor={(item) => item.cardId}
          contentContainerStyle={{
            paddingHorizontal: spacing['5'],
            paddingBottom: spacing['10'],
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          ListEmptyComponent={
            <Text style={[typography.body, { color: palette.textSecondary, marginTop: spacing['6'] }]}>
              {Strings.businessCards.nfcListEmpty}
            </Text>
          }
          renderItem={({ item }) => {
            const owner =
              (item.assignedProfileId && namesByProfile[item.assignedProfileId]) ||
              Strings.businessCards.unassigned;
            return (
              <Pressable
                onPress={() =>
                  router.push(href(`/business-card-nfc/${item.cardId}`) as never)
                }
                accessibilityRole="button"
                accessibilityLabel={`${Strings.businessCards.programNfc} ${owner}`}
                style={{
                  marginBottom: spacing['3'],
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                  borderRadius: 12,
                  padding: spacing['4'],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text style={[typography.h3, { color: palette.textPrimary, flex: 1 }]}>
                    {owner}
                  </Text>
                  <Badge label={item.status} tone={statusTone(item.status)} />
                </View>
                <Text
                  style={[
                    typography.caption,
                    { color: palette.textSecondary, marginTop: spacing['2'] },
                  ]}
                >
                  {item.tagType} · {shortCardId(item.cardId)}
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: palette.amber, marginTop: spacing['2'] },
                  ]}
                  numberOfLines={2}
                >
                  {item.permanentUrl}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

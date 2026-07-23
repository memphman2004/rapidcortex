import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnterTheCortex } from '@/components/splash/EnterTheCortex';
import { useAuth } from '@/hooks/useAuth';
import { hasEnteredCortexRecently, markCortexEntered } from '@/services/splash';
import type { ProductPath } from '@/stores/auth.store';
import { Colors, Spacing, Typography, BorderRadius } from '@/theme';
import { isSafeSoundPublicEnabled } from '@/utils/feature-flags';
import { isCampusRole, isVenueRole } from '@/utils/roles';
import { Strings } from '@/utils/strings';

type Gate = 'enter' | 'products';

export default function ProductSelectionScreen() {
  const router = useRouter();
  const { isAuthenticated, productPath, setProductPath, role } = useAuth();
  const [gate, setGate] = useState<Gate>('enter');
  const [choosing, setChoosing] = useState(false);
  const safeSoundPublic = isSafeSoundPublicEnabled();

  useEffect(() => {
    let cancelled = false;
    void hasEnteredCortexRecently()
      .then((entered) => {
        if (!cancelled && entered) setGate('products');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const onEnterComplete = useCallback(async () => {
    await markCortexEntered();
    setGate('products');
  }, []);

  if (gate === 'enter') {
    return <EnterTheCortex onEnterComplete={onEnterComplete} />;
  }

  // Only auto-route when session + product + role all agree.
  if (isAuthenticated && productPath === 'safe-sound' && safeSoundPublic) {
    return <Redirect href="/(safe-sound)" />;
  }
  if (isAuthenticated && productPath === 'venue' && isVenueRole(role)) {
    return <Redirect href="/(venue)" />;
  }
  if (isAuthenticated && productPath === 'campus' && isCampusRole(role)) {
    return <Redirect href="/(campus)" />;
  }

  const choose = async (path: ProductPath) => {
    if (choosing) return;
    if (path === 'safe-sound' && !safeSoundPublic) return;
    setChoosing(true);
    try {
      await setProductPath(path);
      if (path === 'safe-sound') {
        router.push('/(auth)/safe-sound-login');
        return;
      }
      router.push(path === 'campus' ? '/(auth)/campus-login' : '/(auth)/venue-login');
    } finally {
      setChoosing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>{Strings.app.name}</Text>
        <Text style={styles.tagline}>{Strings.app.tagline}</Text>
      </View>

      <View style={styles.cards}>
        <Pressable
          onPress={() => void choose('venue')}
          disabled={choosing}
          accessibilityRole="button"
          accessibilityLabel={Strings.productSelection.venueTitle}
          style={({ pressed }) => [
            styles.card,
            {
              opacity: pressed || choosing ? 0.9 : 1,
              borderColor: Colors.venue.amber,
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.venue.amber }]}>
            <Text style={styles.iconText}>VN</Text>
          </View>
          <Text style={styles.cardTitle}>{Strings.productSelection.venueTitle}</Text>
          <Text style={styles.cardSubtitle}>{Strings.productSelection.venueSubtitle}</Text>
        </Pressable>

        <Pressable
          onPress={() => void choose('campus')}
          disabled={choosing}
          accessibilityRole="button"
          accessibilityLabel={Strings.productSelection.campusTitle}
          style={({ pressed }) => [
            styles.card,
            {
              opacity: pressed || choosing ? 0.9 : 1,
              borderColor: Colors.campus.amber,
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.campus.amber }]}>
            <Text style={styles.iconText}>CP</Text>
          </View>
          <Text style={styles.cardTitle}>{Strings.productSelection.campusTitle}</Text>
          <Text style={styles.cardSubtitle}>{Strings.productSelection.campusSubtitle}</Text>
        </Pressable>

        {safeSoundPublic ? (
          <Pressable
            onPress={() => void choose('safe-sound')}
            disabled={choosing}
            accessibilityRole="button"
            accessibilityLabel={Strings.productSelection.safeSoundTitle}
            style={({ pressed }) => [
              styles.card,
              {
                opacity: pressed || choosing ? 0.9 : 1,
                borderColor: Colors.venue.blue,
              },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: Colors.venue.blue }]}>
              <Text style={styles.iconText}>RC</Text>
            </View>
            <Text style={styles.cardTitle}>{Strings.productSelection.safeSoundTitle}</Text>
            <Text style={styles.cardSubtitle}>{Strings.productSelection.safeSoundSubtitle}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.venue.background,
    paddingHorizontal: Spacing['5'],
  },
  header: {
    marginTop: Spacing['12'],
    marginBottom: Spacing['10'],
    alignItems: 'center',
  },
  appName: {
    fontFamily: Typography.fontFamily.extraBold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.venue.textPrimary,
  },
  tagline: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.venue.textSecondary,
    marginTop: Spacing['2'],
    textAlign: 'center',
  },
  cards: {
    gap: Spacing['4'],
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing['6'],
    borderWidth: 1,
    backgroundColor: Colors.venue.surface,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['4'],
  },
  iconText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.venue.textPrimary,
  },
  cardTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.venue.textPrimary,
  },
  cardSubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing['2'],
    color: Colors.venue.textSecondary,
  },
});

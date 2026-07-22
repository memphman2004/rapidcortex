import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnterTheCortex } from '@/components/splash/EnterTheCortex';
import { useAuth } from '@/hooks/useAuth';
import { hasEnteredCortexRecently, markCortexEntered } from '@/services/splash';
import type { ProductPath } from '@/stores/auth.store';
import { Colors, Spacing, Typography, BorderRadius } from '@/theme';
import { SplashColors } from '@/theme/splash';
import { isSafeSoundPublicEnabled } from '@/utils/feature-flags';
import { Strings } from '@/utils/strings';

type Gate = 'loading' | 'enter' | 'products';

export default function ProductSelectionScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, productPath, setProductPath } = useAuth();
  const [gate, setGate] = useState<Gate>('loading');
  const safeSoundPublic = isSafeSoundPublicEnabled();

  useEffect(() => {
    let cancelled = false;
    void hasEnteredCortexRecently().then((entered) => {
      if (!cancelled) setGate(entered ? 'products' : 'enter');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onEnterComplete = useCallback(async () => {
    await markCortexEntered();
    setGate('products');
  }, []);

  if (isLoading || gate === 'loading') {
    return <View style={styles.boot} />;
  }

  if (gate === 'enter') {
    return <EnterTheCortex onEnterComplete={onEnterComplete} />;
  }

  if (isAuthenticated && productPath === 'safe-sound' && safeSoundPublic) {
    return <Redirect href="/(safe-sound)" />;
  }
  if (isAuthenticated && productPath === 'venue') {
    return <Redirect href="/(venue)" />;
  }
  if (isAuthenticated && productPath === 'campus') {
    return <Redirect href="/(campus)" />;
  }
  if (!isAuthenticated && productPath === 'safe-sound' && safeSoundPublic) {
    return <Redirect href="/(auth)/safe-sound-login" />;
  }
  if (!isAuthenticated && productPath === 'venue') {
    return <Redirect href="/(auth)/venue-login" />;
  }
  if (!isAuthenticated && productPath === 'campus') {
    return <Redirect href="/(auth)/campus-login" />;
  }

  const choose = async (path: ProductPath) => {
    if (path === 'safe-sound' && !safeSoundPublic) return;
    await setProductPath(path);
    if (path === 'safe-sound') {
      router.push('/(auth)/safe-sound-login');
      return;
    }
    router.push(path === 'campus' ? '/(auth)/campus-login' : '/(auth)/venue-login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>{Strings.app.name}</Text>
        <Text style={styles.tagline}>{Strings.app.tagline}</Text>
      </View>

      <View style={styles.cards}>
        <Pressable
          onPress={() => choose('venue')}
          accessibilityRole="button"
          accessibilityLabel={Strings.productSelection.venueTitle}
          style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1, borderColor: Colors.venue.amber }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.venue.amber }]}>
            <Text style={styles.iconText}>VN</Text>
          </View>
          <Text style={styles.cardTitle}>{Strings.productSelection.venueTitle}</Text>
          <Text style={styles.cardSubtitle}>{Strings.productSelection.venueSubtitle}</Text>
        </Pressable>

        <Pressable
          onPress={() => choose('campus')}
          accessibilityRole="button"
          accessibilityLabel={Strings.productSelection.campusTitle}
          style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1, borderColor: Colors.campus.amber }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.campus.amber }]}>
            <Text style={styles.iconText}>CP</Text>
          </View>
          <Text style={styles.cardTitle}>{Strings.productSelection.campusTitle}</Text>
          <Text style={styles.cardSubtitle}>{Strings.productSelection.campusSubtitle}</Text>
        </Pressable>

        {safeSoundPublic ? (
          <Pressable
            onPress={() => choose('safe-sound')}
            accessibilityRole="button"
            accessibilityLabel={Strings.productSelection.safeSoundTitle}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1, borderColor: Colors.venue.blue }]}
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
  boot: {
    flex: 1,
    backgroundColor: SplashColors.background,
  },
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

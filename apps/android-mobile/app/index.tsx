import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { EnterTheCortex } from '@/components/splash/EnterTheCortex';
import { useAuth } from '@/hooks/useAuth';
import { hasEnteredCortexRecently, markCortexEntered } from '@/services/splash';
import type { ProductPath } from '@/stores/auth.store';
import { Colors, Spacing, BorderRadius } from '@/theme';
import { isEnterSplashEnabled, isSafeSoundPublicEnabled } from '@/utils/feature-flags';
import { Strings } from '@/utils/strings';

type Gate = 'enter' | 'products';

/**
 * Product picker after the native launch image.
 * System fonts only (no custom fontFamily) so labels paint on first frame.
 * Navigate with the router after a tap — do not swap this tree for a redirect
 * component on the first render (that left an empty stack in TestFlight 37).
 */
export default function ProductSelectionScreen() {
  const router = useRouter();
  const { setProductPath } = useAuth();
  const [gate, setGate] = useState<Gate>(isEnterSplashEnabled() ? 'enter' : 'products');
  const [choosing, setChoosing] = useState(false);
  const safeSoundPublic = isSafeSoundPublicEnabled();

  useEffect(() => {
    if (!isEnterSplashEnabled()) return;
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

  const onEnterComplete = useCallback(() => {
    void markCortexEntered().catch((err) => {
      console.warn('[splash] markCortexEntered failed', err);
    });
    setGate('products');
  }, []);

  if (gate === 'enter') {
    return (
      <ScreenErrorBoundary>
        <EnterTheCortex onEnterComplete={onEnterComplete} />
      </ScreenErrorBoundary>
    );
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
    <ScreenErrorBoundary>
      <View style={styles.container}>
        <Text style={styles.appName}>{Strings.app.name}</Text>
        <Text style={styles.tagline}>{Strings.app.tagline}</Text>

        <Pressable
          onPress={() => void choose('venue')}
          disabled={choosing}
          accessibilityRole="button"
          accessibilityLabel={Strings.productSelection.venueTitle}
          style={({ pressed }) => [styles.card, { opacity: pressed || choosing ? 0.85 : 1 }]}
        >
          <Text style={styles.cardKicker}>VN</Text>
          <Text style={styles.cardTitle}>{Strings.productSelection.venueTitle}</Text>
          <Text style={styles.cardSubtitle}>{Strings.productSelection.venueSubtitle}</Text>
        </Pressable>

        <Pressable
          onPress={() => void choose('campus')}
          disabled={choosing}
          accessibilityRole="button"
          accessibilityLabel={Strings.productSelection.campusTitle}
          style={({ pressed }) => [styles.card, { opacity: pressed || choosing ? 0.85 : 1 }]}
        >
          <Text style={styles.cardKicker}>CP</Text>
          <Text style={styles.cardTitle}>{Strings.productSelection.campusTitle}</Text>
          <Text style={styles.cardSubtitle}>{Strings.productSelection.campusSubtitle}</Text>
        </Pressable>

        {safeSoundPublic ? (
          <Pressable
            onPress={() => void choose('safe-sound')}
            disabled={choosing}
            accessibilityRole="button"
            accessibilityLabel={Strings.productSelection.safeSoundTitle}
            style={({ pressed }) => [styles.card, { opacity: pressed || choosing ? 0.85 : 1 }]}
          >
            <Text style={styles.cardKicker}>RC</Text>
            <Text style={styles.cardTitle}>{Strings.productSelection.safeSoundTitle}</Text>
            <Text style={styles.cardSubtitle}>{Strings.productSelection.safeSoundSubtitle}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.venue.background,
    paddingHorizontal: Spacing['5'],
    paddingTop: 72,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing['6'],
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#1E293B',
    marginBottom: Spacing['4'],
    minHeight: 96,
  },
  cardKicker: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 8,
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 6,
    color: '#CBD5E1',
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NeuralField } from '@/components/splash/NeuralField';
import { SplashColors } from '@/theme/splash';
import { Strings } from '@/utils/strings';

const STATUS_MESSAGES = [
  Strings.enterSplash.statusNeural,
  Strings.enterSplash.statusOnline,
  Strings.enterSplash.statusRouting,
] as const;

const STATUS_COLORS = [
  SplashColors.statusBlue,
  SplashColors.statusRed,
  SplashColors.statusWhite,
] as const;

interface EnterTheCortexProps {
  onEnterComplete: () => void;
}

export function EnterTheCortex({ onEnterComplete }: EnterTheCortexProps) {
  const [accessing, setAccessing] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const ringA = useRef(new Animated.Value(1)).current;
  const ringB = useRef(new Animated.Value(1)).current;
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const makePulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1.07,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const a = makePulse(ringA, 0);
    const b = makePulse(ringB, 1000);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [reduceMotion, ringA, ringB]);

  useEffect(() => {
    if (!accessing || reduceMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [accessing, blink, reduceMotion]);

  const handleEnter = useCallback(() => {
    if (accessing) return;
    setAccessing(true);
    setStatusIndex(0);

    let step = 0;
    const advance = () => {
      if (step >= STATUS_MESSAGES.length - 1) {
        setTimeout(onEnterComplete, 650);
        return;
      }
      step += 1;
      setStatusIndex(step);
      setTimeout(advance, 520);
    };
    setTimeout(advance, 520);
  }, [accessing, onEnterComplete]);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      {!reduceMotion ? <NeuralField /> : null}

      <View style={styles.content}>
        <Text style={styles.eyebrow}>{Strings.enterSplash.eyebrow}</Text>
        <Text style={styles.title}>
          {Strings.enterSplash.titleLine1}
          {'\n'}
          <Text style={styles.cortex}>{Strings.enterSplash.titleLine2}</Text>
        </Text>
        <Text style={styles.tagline}>{Strings.enterSplash.tagline}</Text>

        <View style={styles.buttonWrap}>
          <Animated.View
            style={[
              styles.ring,
              styles.ringInner,
              { transform: [{ scale: ringA }], opacity: reduceMotion ? 0.35 : 1 },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              styles.ringOuter,
              { transform: [{ scale: ringB }], opacity: reduceMotion ? 0.2 : 1 },
            ]}
          />

          <Pressable
            onPress={handleEnter}
            disabled={accessing}
            accessibilityRole="button"
            accessibilityLabel={Strings.enterSplash.initialize}
            style={({ pressed }) => [
              styles.button,
              accessing && styles.buttonAccessing,
              pressed && !accessing && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Text style={[styles.buttonText, accessing && styles.buttonTextAccessing]}>
              {accessing ? Strings.enterSplash.accessing : Strings.enterSplash.initialize}
            </Text>
          </Pressable>
        </View>
      </View>

      {accessing ? (
        <View style={styles.overlay} accessibilityLiveRegion="assertive">
          <Animated.Text style={[styles.status, { color: STATUS_COLORS[statusIndex], opacity: blink }]}>
            {STATUS_MESSAGES[statusIndex]}
          </Animated.Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SplashColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    zIndex: 10,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 3.4,
    textTransform: 'uppercase',
    color: SplashColors.eyebrow,
    marginBottom: 18,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 46,
    color: SplashColors.title,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  cortex: {
    color: SplashColors.cortex,
  },
  tagline: {
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: SplashColors.tagline,
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  buttonWrap: {
    marginTop: 42,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 5,
  },
  ringInner: {
    top: -14,
    bottom: -14,
    left: -14,
    right: -14,
    borderWidth: 1,
    borderColor: SplashColors.ringInner,
    borderRadius: 3,
  },
  ringOuter: {
    top: -28,
    bottom: -28,
    left: -28,
    right: -28,
    borderWidth: 1,
    borderColor: SplashColors.ringOuter,
  },
  button: {
    borderWidth: 1,
    borderColor: SplashColors.buttonBorder,
    paddingVertical: 17,
    paddingHorizontal: 52,
    borderRadius: 2,
    backgroundColor: 'transparent',
    minWidth: 220,
    alignItems: 'center',
  },
  buttonAccessing: {
    borderColor: 'rgba(239,68,68,0.45)',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 3.1,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
  },
  buttonTextAccessing: {
    color: SplashColors.accessing,
  },
  corner: {
    position: 'absolute',
    width: 9,
    height: 9,
  },
  tl: {
    top: -1,
    left: -1,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: SplashColors.cortex,
  },
  tr: {
    top: -1,
    right: -1,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#3b82f6',
  },
  bl: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: '#3b82f6',
  },
  br: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: SplashColors.cortex,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: SplashColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

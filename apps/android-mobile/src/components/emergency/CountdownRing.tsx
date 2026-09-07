import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface CountdownRingProps {
  remainingSeconds: number;
  totalSeconds: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function CountdownRing({
  remainingSeconds,
  totalSeconds,
  size = 260,
  strokeWidth = 14,
  label,
}: CountdownRingProps) {
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { countdown: string; textPrimary: string; textSecondary: string };

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = useRef(new Animated.Value(totalSeconds > 0 ? remainingSeconds / totalSeconds : 0));

  useEffect(() => {
    Animated.timing(fraction.current, {
      toValue: totalSeconds > 0 ? Math.max(0, remainingSeconds / totalSeconds) : 0,
      duration: 950,
      useNativeDriver: true,
    }).start();
  }, [remainingSeconds, totalSeconds]);

  const strokeDashoffset = fraction.current.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.countdown}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference}, ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <Text
        style={[typography.emergencyCountdown, { color: palette.textPrimary }]}
        accessibilityLabel={Strings.emergency.countdownAccessibility(remainingSeconds)}
      >
        {Math.max(0, remainingSeconds)}
      </Text>
      {label ? (
        <Text
          style={[
            typography.caption,
            { color: palette.textSecondary, marginTop: spacing['1'], textAlign: 'center', maxWidth: size * 0.8 },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

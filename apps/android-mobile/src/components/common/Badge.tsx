import { StyleSheet, Text, View } from 'react-native';
import { getAccentColor, getDangerColor, getSuccessColor, useTheme } from '@/theme';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
}

export function Badge({ label, tone = 'neutral', size = 'md' }: BadgeProps) {
  const theme = useTheme();
  const { colors, typography, borderRadius, spacing } = theme;
  const palette = colors as {
    surfaceAlt: string;
    border: string;
    textSecondary: string;
    amber?: string;
  };

  const toneColor = (() => {
    switch (tone) {
      case 'accent':
        return getAccentColor(theme);
      case 'success':
        return getSuccessColor(theme);
      case 'danger':
        return getDangerColor(theme);
      case 'warning':
        return palette.amber ?? getAccentColor(theme);
      case 'neutral':
      default:
        return palette.textSecondary;
    }
  })();

  return (
    <View
      style={[
        styles.base,
        {
          borderColor: toneColor,
          backgroundColor: tone === 'neutral' ? palette.surfaceAlt : `${toneColor}1A`,
          borderRadius: borderRadius.full,
          paddingHorizontal: size === 'sm' ? spacing['2'] : spacing['3'],
          paddingVertical: size === 'sm' ? 2 : 4,
        },
      ]}
    >
      <Text
        style={[
          size === 'sm' ? typography.caption : typography.label,
          { color: toneColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});

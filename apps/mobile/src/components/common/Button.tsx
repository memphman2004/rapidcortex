import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getAccentColor, getDangerColor, useTheme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  leftIcon,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const { colors, borderRadius, typography } = theme;

  const palette = useMemo(() => {
    const accent = getAccentColor(theme);
    const danger = getDangerColor(theme);
    const surface = (colors as { surface: string; surfaceAlt: string }).surface;
    const surfaceAlt = (colors as { surfaceAlt: string }).surfaceAlt;
    const border = (colors as { border: string }).border;
    const textPrimary = (colors as { textPrimary: string }).textPrimary;

    switch (variant) {
      case 'primary':
        return { background: accent, textColor: '#FFFFFF', borderColor: accent };
      case 'danger':
        return { background: danger, textColor: '#FFFFFF', borderColor: danger };
      case 'secondary':
        return { background: surfaceAlt, textColor: textPrimary, borderColor: border };
      case 'ghost':
      default:
        return { background: 'transparent', textColor: accent, borderColor: 'transparent' };
    }
  }, [variant, theme, colors]);

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          backgroundColor: palette.background,
          borderColor: palette.borderColor,
          borderRadius: borderRadius.md,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? 14 : 20,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.textColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <Text
            style={[
              typography.button,
              { color: palette.textColor, fontSize: size === 'sm' ? 14 : typography.button.fontSize },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

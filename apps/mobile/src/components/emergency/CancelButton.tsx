import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

export interface CancelButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function CancelButton({ onPress, loading = false, disabled = false }: CancelButtonProps) {
  const { colors, typography, borderRadius, layout } = useTheme();
  const palette = colors as { cancelButton: string; cancelText: string };
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={Strings.emergency.cancelButton}
      accessibilityHint={Strings.emergency.cancelHint}
      style={({ pressed }) => [
        styles.base,
        {
          height: layout.emergencyCancelButtonHeight,
          backgroundColor: palette.cancelButton,
          borderRadius: borderRadius.xl,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.cancelText} size="large" />
      ) : (
        <Text style={[typography.h1, { color: palette.cancelText, textAlign: 'center' }]}>
          {Strings.emergency.cancelButton}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});

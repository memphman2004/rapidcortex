import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

export interface InputProps
  extends Pick<
    TextInputProps,
    'onSubmitEditing' | 'returnKeyType' | 'autoFocus' | 'onBlur' | 'onFocus' | 'maxLength'
  > {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  helperText?: string;
  secureTextEntry?: boolean;
  /** When true with secureTextEntry, shows Show/Hide control. */
  passwordToggle?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  multiline?: boolean;
  editable?: boolean;
  rightElement?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    value,
    onChangeText,
    placeholder,
    error,
    helperText,
    secureTextEntry = false,
    passwordToggle = false,
    keyboardType = 'default',
    autoCapitalize = 'none',
    autoCorrect = false,
    multiline = false,
    editable = true,
    rightElement,
    style,
    testID,
    ...rest
  },
  ref,
) {
  const { colors, typography, borderRadius, spacing } = useTheme();
  const palette = colors as {
    surface: string;
    border: string;
    textPrimary: string;
    textMuted: string;
    textSecondary: string;
    red: string;
  };
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isSecure = Boolean(secureTextEntry) && !revealed;

  const toggle =
    passwordToggle && secureTextEntry ? (
      <Pressable
        onPress={() => setRevealed((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={revealed ? Strings.auth.hidePassword : Strings.auth.showPassword}
        style={styles.toggle}
      >
        <Text style={[typography.caption, { color: palette.textSecondary, fontWeight: '600' }]}>
          {revealed ? Strings.auth.hidePassword : Strings.auth.showPassword}
        </Text>
      </Pressable>
    ) : null;

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={[typography.label, { color: palette.textPrimary, marginBottom: spacing['1.5'] }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: palette.surface,
            borderColor: error ? palette.red : focused ? palette.textPrimary : palette.border,
            borderRadius: borderRadius.md,
            minHeight: multiline ? 96 : 48,
          },
        ]}
      >
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          multiline={multiline}
          editable={editable}
          textContentType={secureTextEntry ? 'password' : undefined}
          autoComplete={secureTextEntry ? 'password' : undefined}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          onSubmitEditing={rest.onSubmitEditing}
          returnKeyType={rest.returnKeyType}
          autoFocus={rest.autoFocus}
          maxLength={rest.maxLength}
          style={[
            typography.body,
            styles.input,
            { color: palette.textPrimary, textAlignVertical: multiline ? 'top' : 'center' },
          ]}
        />
        {toggle ?? rightElement}
      </View>
      {error ? (
        <Text style={[typography.caption, { color: palette.red, marginTop: spacing['1'] }]}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing['1'] }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
  },
  toggle: {
    paddingLeft: 8,
    paddingVertical: 8,
  },
});

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import { ThemeProvider, useTheme } from '@/theme';
import {
  getPasswordRequirementStatus,
  validateEmail,
  validatePasswordConfirmation,
  validateRequired,
} from '@/utils/validation';
import { Strings } from '@/utils/strings';

type Mode = 'sign-in' | 'sign-up' | 'confirm';

function SafeSoundLoginContent() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    textPrimary: string;
    textSecondary: string;
    blue: string;
    green?: string;
  };
  const { signIn, signUp, confirmSignUp, error, isLoading, clearError } = useAuth();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const passwordStatus = useMemo(() => getPasswordRequirementStatus(password), [password]);

  const handleSignIn = async () => {
    setFieldError(null);
    clearError();
    const emailResult = validateEmail(email);
    if (!emailResult.valid) return setFieldError(emailResult.error ?? null);
    const passwordResult = validateRequired(password, 'Password');
    if (!passwordResult.valid) return setFieldError(passwordResult.error ?? null);

    try {
      await signIn(email, password);
      router.replace('/(safe-sound)');
    } catch {
      // error surfaced via auth store state
    }
  };

  const handleSignUp = async () => {
    setFieldError(null);
    clearError();
    const emailResult = validateEmail(email);
    if (!emailResult.valid) return setFieldError(emailResult.error ?? null);
    const firstResult = validateRequired(firstName, Strings.auth.firstName);
    if (!firstResult.valid) return setFieldError(firstResult.error ?? null);
    const lastResult = validateRequired(lastName, Strings.auth.lastName);
    if (!lastResult.valid) return setFieldError(lastResult.error ?? null);
    const confirmResult = validatePasswordConfirmation(password, confirmPassword);
    if (!confirmResult.valid) return setFieldError(confirmResult.error ?? null);

    try {
      await signUp(email, password, firstName, lastName);
      setInfoMessage(null);
      setMode('confirm');
    } catch {
      // error surfaced via auth store state
    }
  };

  const handleConfirm = async () => {
    setFieldError(null);
    clearError();
    const codeResult = validateRequired(code, Strings.auth.verificationCode);
    if (!codeResult.valid) return setFieldError(codeResult.error ?? null);

    try {
      await confirmSignUp(email, code);
      setInfoMessage('Account verified. Sign in to continue.');
      setMode('sign-in');
      setPassword('');
      setCode('');
    } catch {
      // error surfaced via auth store state
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      Strings.auth.forgotPassword,
      Strings.auth.noAccountContactAdmin,
    );
  };

  const displayedError = fieldError ?? error;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing['5'], flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginTop: spacing['8'], marginBottom: spacing['8'] }}>
            <Text style={[typography.display, { color: palette.textPrimary }]}>
              {Strings.productSelection.safeSoundTitle}
            </Text>
            <Text style={[typography.body, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
              {Strings.productSelection.safeSoundSubtitle}
            </Text>
          </View>

          {infoMessage ? (
            <Text style={[typography.caption, { color: palette.green ?? palette.blue, marginBottom: spacing['3'] }]}>
              {infoMessage}
            </Text>
          ) : null}

          {mode === 'confirm' ? (
            <View style={{ gap: spacing['4'] }}>
              <Text style={[typography.body, { color: palette.textSecondary }]}>
                Enter the verification code sent to {email}.
              </Text>
              <Input
                label={Strings.auth.verificationCode}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="123456"
              />
              {displayedError ? (
                <Text style={[typography.caption, { color: '#EF4444' }]}>{displayedError}</Text>
              ) : null}
              <Button title={Strings.common.confirm} onPress={handleConfirm} loading={isLoading} />
              <Button
                title={Strings.common.cancel}
                variant="ghost"
                onPress={() => setMode('sign-in')}
              />
            </View>
          ) : (
            <View style={{ gap: spacing['4'] }}>
              {mode === 'sign-up' ? (
                <View style={{ flexDirection: 'row', gap: spacing['3'] }}>
                  <Input
                    label={Strings.auth.firstName}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    style={{ flex: 1 }}
                  />
                  <Input
                    label={Strings.auth.lastName}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}

              <Input
                label={Strings.auth.email}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                placeholder="you@example.com"
              />

              <Input
                label={Strings.auth.password}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {mode === 'sign-up' ? (
                <>
                  <Input
                    label={Strings.auth.confirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                  <View style={{ gap: spacing['1'] }}>
                    {[
                      ['At least 12 characters', passwordStatus.minLength],
                      ['An uppercase letter', passwordStatus.uppercase],
                      ['A lowercase letter', passwordStatus.lowercase],
                      ['A number', passwordStatus.number],
                      ['A symbol', passwordStatus.symbol],
                    ].map(([label, met]) => (
                      <Text
                        key={label as string}
                        style={[typography.caption, { color: met ? (palette.green ?? palette.blue) : palette.textSecondary }]}
                      >
                        {met ? '✓' : '•'} {label as string}
                      </Text>
                    ))}
                  </View>
                </>
              ) : null}

              {displayedError ? (
                <Text style={[typography.caption, { color: '#EF4444' }]}>{displayedError}</Text>
              ) : null}

              {mode === 'sign-in' ? (
                <Text
                  onPress={handleForgotPassword}
                  style={[typography.caption, { color: palette.blue, alignSelf: 'flex-end' }]}
                >
                  {Strings.auth.forgotPassword}
                </Text>
              ) : null}

              <Button
                title={mode === 'sign-in' ? Strings.auth.signIn : Strings.auth.createAccount}
                onPress={mode === 'sign-in' ? handleSignIn : handleSignUp}
                loading={isLoading}
              />

              <Button
                title={mode === 'sign-in' ? Strings.auth.createAccount : Strings.auth.signIn}
                variant="ghost"
                onPress={() => {
                  setFieldError(null);
                  clearError();
                  setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function SafeSoundLoginScreen() {
  return (
    <ThemeProvider product="safeSound">
      <SafeSoundLoginContent />
    </ThemeProvider>
  );
}

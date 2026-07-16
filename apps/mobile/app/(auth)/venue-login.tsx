import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import { ThemeProvider, useTheme } from '@/theme';
import { isVenueCampusRole } from '@/utils/roles';
import { validateEmail, validateRequired } from '@/utils/validation';
import { Strings } from '@/utils/strings';

function VenueLoginContent() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { textPrimary: string; textSecondary: string; amber: string };
  const { signIn, signOut, error, isLoading, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setFieldError(null);
    clearError();

    const emailResult = validateEmail(email);
    if (!emailResult.valid) return setFieldError(emailResult.error ?? null);
    const passwordResult = validateRequired(password, 'Password');
    if (!passwordResult.valid) return setFieldError(passwordResult.error ?? null);

    try {
      await signIn(email, password);
      const role = useAuthStore.getState().user?.['custom:role'] ?? '';
      if (!isVenueCampusRole(role)) {
        await signOut();
        setFieldError(Strings.auth.errors.venueAccessDenied);
        return;
      }
      router.replace('/(venue)');
    } catch {
      // error surfaced via auth store state
    }
  };

  const displayedError = fieldError ?? error;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing['5'], flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginTop: spacing['10'], marginBottom: spacing['8'] }}>
            <Text style={[typography.label, { color: palette.amber, letterSpacing: 1 }]}>
              {Strings.auth.venueCampusTools.toUpperCase()}
            </Text>
            <Text style={[typography.display, { color: palette.textPrimary, marginTop: spacing['2'] }]}>
              {Strings.productSelection.venueCampusTitle}
            </Text>
            <Text style={[typography.body, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
              {Strings.productSelection.venueCampusSubtitle}
            </Text>
          </View>

          <View style={{ gap: spacing['4'] }}>
            <Input
              label={Strings.auth.email}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="you@agency.gov"
            />
            <Input
              label={Strings.auth.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {displayedError ? (
              <Text style={[typography.caption, { color: '#EF4444' }]}>{displayedError}</Text>
            ) : null}

            <Button title={Strings.auth.signIn} onPress={handleSignIn} loading={isLoading} />

            <Text style={[typography.caption, { color: palette.textSecondary, textAlign: 'center', marginTop: spacing['2'] }]}>
              {Strings.auth.noAccountContactAdmin}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function VenueLoginScreen() {
  return (
    <ThemeProvider product="venue">
      <VenueLoginContent />
    </ThemeProvider>
  );
}

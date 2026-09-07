import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import { ThemeProvider, useTheme } from '@/theme';
import { isTransitRole, isVenueRole } from '@/utils/roles';
import { validateEmail, validateRequired } from '@/utils/validation';
import { Strings } from '@/utils/strings';

function VenueLoginContent() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { textPrimary: string; textSecondary: string; amber: string };
  const { signIn, signOut, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const goBack = () => {
    void useAuthStore.getState().clearProductPath();
    router.replace('/');
  };

  const handleSignIn = async () => {
    if (submitting) return;
    setFieldError(null);
    clearError();

    const emailResult = validateEmail(email);
    if (!emailResult.valid) return setFieldError(emailResult.error ?? null);
    const passwordResult = validateRequired(password, 'Password');
    if (!passwordResult.valid) return setFieldError(passwordResult.error ?? null);

    setSubmitting(true);
    try {
      await signIn(email, password);
      const role = useAuthStore.getState().user?.['custom:role'] ?? '';
      if (!isVenueRole(role) && !isTransitRole(role)) {
        await signOut();
        setFieldError(Strings.auth.errors.venueAccessDenied);
        return;
      }
      await useAuthStore.getState().setProductPath('venue');
      // Prefer explicit venue home — don't let a campus-looking token steal the route.
      router.replace('/(venue)');
    } catch {
      // error surfaced via auth store state
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = fieldError ?? error;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing['5'], flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => void goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={Strings.auth.backToProducts}
            style={{ alignSelf: 'flex-start', marginBottom: spacing['4'] }}
          >
            <Text style={[typography.label, { color: palette.textSecondary }]}>
              {Strings.auth.backToProducts}
            </Text>
          </Pressable>

          <View style={{ marginTop: spacing['2'], marginBottom: spacing['8'] }}>
            <Text style={[typography.label, { color: palette.amber, letterSpacing: 1 }]}>
              {Strings.auth.venueTools.toUpperCase()}
            </Text>
            <Text style={[typography.display, { color: palette.textPrimary, marginTop: spacing['2'] }]}>
              {Strings.productSelection.venueTitle}
            </Text>
            <Text style={[typography.body, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
              {Strings.productSelection.venueSubtitle}
            </Text>
          </View>

          <View style={{ gap: spacing['4'] }}>
            <Input
              label={Strings.auth.email}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@agency.gov"
            />
            <Input
              label={Strings.auth.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              passwordToggle
            />

            {displayedError ? (
              <Text style={[typography.caption, { color: '#EF4444' }]}>{displayedError}</Text>
            ) : null}

            <Button title={Strings.auth.signIn} onPress={() => void handleSignIn()} loading={submitting} />

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

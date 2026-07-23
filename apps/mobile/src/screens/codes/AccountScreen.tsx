import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

function AccountScreenContent() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    background: string;
    textPrimary: string;
    textSecondary: string;
    amber: string;
    red: string;
    border: string;
  };

  const { user, agencyId, role, biometricEnabled, enableBiometric, signOut } = useAuth();
  const [biometricBusy, setBiometricBusy] = useState(false);

  const handleToggleBiometric = async (value: boolean) => {
    if (!value) return;
    setBiometricBusy(true);
    try {
      await enableBiometric();
    } catch (error) {
      Alert.alert(
        Strings.common.somethingWentWrong,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(Strings.common.signOut, undefined, [
      { text: Strings.common.cancel, style: 'cancel' },
      {
        text: Strings.common.signOut,
        style: 'destructive',
        onPress: () => {
          void signOut()
            .catch(() => undefined)
            .finally(() => {
              router.replace('/');
            });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['5'] }]}>
          {Strings.venue.account}
        </Text>

        <Card style={{ marginBottom: spacing['4'] }}>
          <Text style={[typography.h3, { color: palette.textPrimary }]}>
            {user?.email?.trim() || '—'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing['3'] }}>
            <Badge label={role || '—'} tone="accent" size="sm" />
          </View>
        </Card>

        <Text
          style={[
            typography.label,
            { color: palette.textSecondary, marginBottom: spacing['2'] },
          ]}
        >
          DETAILS
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: spacing['2'],
            }}
          >
            <Text style={[typography.body, { color: palette.textSecondary }]}>
              {Strings.venue.accountDetails.role}
            </Text>
            <Text style={[typography.body, { color: palette.textPrimary }]}>{role || '—'}</Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: spacing['2'],
              borderTopWidth: 1,
              borderColor: palette.border,
            }}
          >
            <Text style={[typography.body, { color: palette.textSecondary }]}>
              {Strings.venue.accountDetails.agency}
            </Text>
            <Text
              style={[typography.body, { color: palette.textPrimary, flex: 1, textAlign: 'right' }]}
              numberOfLines={2}
            >
              {agencyId || '—'}
            </Text>
          </View>
        </Card>

        <Text
          style={[
            typography.label,
            { color: palette.textSecondary, marginBottom: spacing['2'] },
          ]}
        >
          PREFERENCES
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing['2'],
            }}
          >
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>
              {Strings.venue.accountDetails.biometricLogin}
            </Text>
            <Switch
              value={biometricEnabled}
              onValueChange={(value) => {
                void handleToggleBiometric(value);
              }}
              disabled={biometricBusy}
              trackColor={{ true: palette.amber }}
            />
          </View>
        </Card>

        <Pressable onPress={handleSignOut} style={{ alignItems: 'center', marginTop: spacing['4'] }}>
          <Text style={[typography.bodyMedium, { color: palette.red }]}>
            {Strings.common.signOut}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AccountScreen() {
  return (
    <ScreenErrorBoundary>
      <AccountScreenContent />
    </ScreenErrorBoundary>
  );
}

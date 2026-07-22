import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { useAuth } from '@/hooks/useAuth';
import { getAgencyProfile, isAgenciesApiError } from '@/services/api/agencies';
import { requestNotificationPermissions } from '@/services/notifications';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import type { AgencySummary } from '@/types/mobile';

export default function AccountScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; amber: string; red: string; border: string };

  const { user, agencyId, role, biometricEnabled, enableBiometric, signOut } = useAuth();

  const [agency, setAgency] = useState<AgencySummary | null>(null);
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    if (!agencyId) return;
    getAgencyProfile(agencyId)
      .then(setAgency)
      .catch((error) => setAgencyError(isAgenciesApiError(error)));

    void requestNotificationPermissions().then(setNotificationsEnabled);
  }, [agencyId]);

  const handleToggleNotifications = async (value: boolean) => {
    if (!value) {
      Alert.alert('Notifications', 'Manage notification permissions in system Settings.', [
        { text: Strings.common.close, style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const granted = await requestNotificationPermissions();
    setNotificationsEnabled(granted);
    if (!granted) Linking.openSettings();
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (!value) return;
    setBiometricBusy(true);
    try {
      await enableBiometric();
    } catch (error) {
      Alert.alert(Strings.common.somethingWentWrong, error instanceof Error ? error.message : undefined);
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
          void signOut();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['5'] }]}>{Strings.venue.account}</Text>

        <Card style={{ marginBottom: spacing['4'] }}>
          <Text style={[typography.h3, { color: palette.textPrimary }]}>{user?.email ?? '—'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing['3'] }}>
            <Badge label={role || '—'} tone="accent" size="sm" />
          </View>
        </Card>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          DETAILS
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing['2'] }}>
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.venue.accountDetails.role}</Text>
            <Text style={[typography.body, { color: palette.textPrimary }]}>{role || '—'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing['2'], borderTopWidth: 1, borderColor: palette.border }}>
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.venue.accountDetails.agency}</Text>
            <Text style={[typography.body, { color: palette.textPrimary }]} numberOfLines={1}>
              {agency?.name ?? agencyError ?? Strings.common.loading}
            </Text>
          </View>
        </Card>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          PREFERENCES
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing['2'] }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.venue.accountDetails.notifications}</Text>
            <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} trackColor={{ true: palette.amber }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing['2'], borderTopWidth: 1, borderColor: palette.border }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.venue.accountDetails.biometricLogin}</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              disabled={biometricBusy}
              trackColor={{ true: palette.amber }}
            />
          </View>
        </Card>

        <Pressable onPress={handleSignOut} style={{ alignItems: 'center', marginTop: spacing['4'] }}>
          <Text style={[typography.bodyMedium, { color: palette.red }]}>{Strings.common.signOut}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

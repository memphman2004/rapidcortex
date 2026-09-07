import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import {
  getSubscriptionPortalUrl,
  isDevicesApiError,
  listSubscriptions,
  updatePreferredLanguage,
} from '@/services/api/devices';
import { requestNotificationPermissions } from '@/services/notifications';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import type { RCLanguage, SSSubscription } from '@/types/mobile';

const STATUS_LABEL: Record<SSSubscription['status'], string> = {
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  trialing: 'Trial',
  incomplete: 'Incomplete',
};

export default function SafeSoundAccountScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    background: string;
    textPrimary: string;
    textSecondary: string;
    blue: string;
    red: string;
    green?: string;
    border: string;
  };

  const {
    user,
    biometricEnabled,
    enableBiometric,
    signOut,
    preferredLanguage,
    setPreferredLanguage,
  } = useAuth();
  const { getLanguageByCode } = useLanguage();

  const [subscriptions, setSubscriptions] = useState<SSSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    setSubscriptionsLoading(true);
    listSubscriptions()
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]))
      .finally(() => setSubscriptionsLoading(false));

    void requestNotificationPermissions().then(setNotificationsEnabled);
  }, []);

  const selectedLanguage = preferredLanguage ? getLanguageByCode(preferredLanguage) : undefined;

  const handleManageSubscription = async (subscriptionId: string) => {
    try {
      const url = await getSubscriptionPortalUrl(subscriptionId);
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(Strings.common.somethingWentWrong, isDevicesApiError(error) ?? undefined);
    }
  };

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
    if (!granted) {
      Linking.openSettings();
    }
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

  const handleSelectLanguage = async (language: RCLanguage) => {
    setLanguagePickerVisible(false);
    try {
      await setPreferredLanguage(language.code);
      await updatePreferredLanguage(language.code);
    } catch {
      Alert.alert(Strings.common.somethingWentWrong);
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
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['5'] }]}>Account</Text>

        <Card style={{ marginBottom: spacing['5'] }}>
          <Text style={[typography.h3, { color: palette.textPrimary }]}>{user?.email ?? '—'}</Text>
        </Card>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          {Strings.safeSound.account.subscriptions.toUpperCase()}
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          {subscriptionsLoading ? (
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.common.loading}</Text>
          ) : subscriptions.length === 0 ? (
            <Text style={[typography.body, { color: palette.textSecondary }]}>No active subscriptions.</Text>
          ) : (
            subscriptions.map((subscription, index) => (
              <View
                key={subscription.subscriptionId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing['2'],
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderColor: palette.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>
                    Guardian · {subscription.deviceSerial}
                  </Text>
                  <Badge label={STATUS_LABEL[subscription.status]} tone={subscription.status === 'active' ? 'success' : 'warning'} size="sm" />
                </View>
                <Pressable onPress={() => handleManageSubscription(subscription.subscriptionId)}>
                  <Text style={[typography.label, { color: palette.blue }]}>{Strings.safeSound.account.manageSubscription}</Text>
                </Pressable>
              </View>
            ))
          )}
        </Card>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          PREFERENCES
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing['2'] }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.safeSound.account.notifications}</Text>
            <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} trackColor={{ true: palette.blue }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing['2'], borderTopWidth: 1, borderColor: palette.border }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.safeSound.account.biometricLogin}</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              disabled={biometricBusy}
              trackColor={{ true: palette.blue }}
            />
          </View>
          <Pressable
            onPress={() => setLanguagePickerVisible(true)}
            style={{ paddingVertical: spacing['2'], borderTopWidth: 1, borderColor: palette.border }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.safeSound.account.myLanguage}</Text>
              <Text style={[typography.body, { color: palette.textSecondary }]}>
                {selectedLanguage?.name ?? Strings.common.useDeviceLanguage}
              </Text>
            </View>
            <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['1'] }]}>
              {Strings.safeSound.account.languageSubtitle}
            </Text>
          </Pressable>
        </Card>

        <Card
          onPress={() => router.push('/(safe-sound)/emergency-contacts')}
          style={{ marginBottom: spacing['5'] }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>
              {Strings.safeSound.account.emergencyContactsShortcut}
            </Text>
            <Text style={{ color: palette.textSecondary }}>›</Text>
          </View>
        </Card>

        <Card onPress={() => router.push('/(safe-sound)/settings')} style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>Settings</Text>
            <Text style={{ color: palette.textSecondary }}>›</Text>
          </View>
        </Card>

        <Pressable onPress={handleSignOut} style={{ alignItems: 'center', marginTop: spacing['4'] }}>
          <Text style={[typography.bodyMedium, { color: palette.red }]}>{Strings.common.signOut}</Text>
        </Pressable>
      </ScrollView>

      <LanguagePicker
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        selectedCode={preferredLanguage}
        onSelect={handleSelectLanguage}
      />
    </SafeAreaView>
  );
}

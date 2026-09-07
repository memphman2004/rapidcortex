import { useRouter } from 'expo-router';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';

export default function SafeSoundSettingsScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; red: string; border: string };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary, marginBottom: spacing['5'] }]}>Settings</Text>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          COMPLIANCE
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>
            {Strings.compliance.not911Replacement}
          </Text>
          <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['2'] }]}>
            {Strings.app.name} {Strings.compliance.fallDetection}, {Strings.compliance.cardiac}, and{' '}
            {Strings.compliance.connectHelp}. It does not replace emergency services, dispatchers, or medical
            direction. Always call 911 in a life-threatening emergency when you are able.
          </Text>
        </Card>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          SUPPORT
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <Text
            style={[typography.bodyMedium, { color: palette.textPrimary }]}
            onPress={() => Linking.openURL('mailto:support@rapidcortex.us')}
          >
            Contact Support
          </Text>
          <Text
            style={[typography.bodyMedium, { color: palette.textPrimary, marginTop: spacing['3'] }]}
            onPress={() => Linking.openURL('https://rapidcortex.us/privacy')}
          >
            Privacy Policy
          </Text>
          <Text
            style={[typography.bodyMedium, { color: palette.textPrimary, marginTop: spacing['3'] }]}
            onPress={() => Linking.openURL('https://rapidcortex.us/terms')}
          >
            Terms of Service
          </Text>
        </Card>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          ABOUT
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[typography.body, { color: palette.textSecondary }]}>Version</Text>
            <Text style={[typography.body, { color: palette.textPrimary }]}>1.0.0</Text>
          </View>
        </Card>

        <Button title={Strings.common.close} variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

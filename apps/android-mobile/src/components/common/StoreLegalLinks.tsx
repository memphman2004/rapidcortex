import { Alert, Linking, Pressable, Text } from 'react-native';
import { Card } from '@/components/common/Card';
import { useTheme } from '@/theme';
import { LEGAL_URLS } from '@/utils/legal-urls';
import { Strings } from '@/utils/strings';

async function openUrl(url: string): Promise<void> {
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert(Strings.common.somethingWentWrong);
    return;
  }
  await Linking.openURL(url);
}

/**
 * Play Store requires a reachable privacy policy and account-deletion path
 * from inside the app (not only the store listing).
 */
export function StoreLegalLinks() {
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    textPrimary: string;
    textSecondary: string;
    border: string;
    amber: string;
  };

  const handleDeletion = () => {
    Alert.alert(
      Strings.venue.accountDetails.requestDeletion,
      Strings.venue.accountDetails.requestDeletionBody,
      [
        { text: Strings.common.cancel, style: 'cancel' },
        {
          text: Strings.venue.accountDetails.continueToRequest,
          onPress: () => {
            void openUrl(LEGAL_URLS.accountDeletion);
          },
        },
      ],
    );
  };

  const rows: Array<{ key: string; label: string; onPress: () => void }> = [
    {
      key: 'privacy',
      label: Strings.venue.accountDetails.privacyPolicy,
      onPress: () => {
        void openUrl(LEGAL_URLS.privacy);
      },
    },
    {
      key: 'terms',
      label: Strings.venue.accountDetails.termsOfUse,
      onPress: () => {
        void openUrl(LEGAL_URLS.terms);
      },
    },
    {
      key: 'deletion',
      label: Strings.venue.accountDetails.requestDeletion,
      onPress: handleDeletion,
    },
  ];

  return (
    <>
      <Text
        style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}
      >
        {Strings.venue.accountDetails.legalSection}
      </Text>
      <Card style={{ marginBottom: spacing['5'] }}>
        {rows.map((row, index) => (
          <Pressable
            key={row.key}
            onPress={row.onPress}
            accessibilityRole="link"
            accessibilityLabel={row.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing['2'],
              borderTopWidth: index === 0 ? 0 : 1,
              borderColor: palette.border,
            }}
          >
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{row.label}</Text>
            <Text style={{ color: palette.textSecondary }}>›</Text>
          </Pressable>
        ))}
      </Card>
    </>
  );
}

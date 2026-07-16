import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CancelButton } from '@/components/emergency/CancelButton';
import { CountdownRing } from '@/components/emergency/CountdownRing';
import { useEmergencyStore } from '@/stores/emergency.store';
import { ThemeProvider, useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import type { EmergencyStatus, GuardianDetectionType } from '@/types/mobile';

const DETECTION_LABEL: Record<GuardianDetectionType, string> = {
  fall: Strings.emergency.fallDetected,
  sos: Strings.emergency.sosActivated,
  immobility: Strings.emergency.noMovement,
  cardiac_distress: Strings.emergency.unusualHeartRate,
};

function EmergencyContent() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; cancelButton: string };

  const event = useEmergencyStore((state) => state.event);
  const isLoading = useEmergencyStore((state) => state.isLoading);
  const error = useEmergencyStore((state) => state.error);
  const remainingSeconds = useEmergencyStore((state) => state.remainingSeconds);
  const isCancelling = useEmergencyStore((state) => state.isCancelling);
  const loadEvent = useEmergencyStore((state) => state.loadEvent);
  const startTicking = useEmergencyStore((state) => state.startTicking);
  const stopTicking = useEmergencyStore((state) => state.stopTicking);
  const cancelEvent = useEmergencyStore((state) => state.cancelEvent);
  const reset = useEmergencyStore((state) => state.reset);

  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    void loadEvent(eventId);
    return () => {
      stopTicking();
    };
  }, [eventId, loadEvent, stopTicking]);

  useEffect(() => {
    if (event?.status === 'COUNTDOWN_ACTIVE') {
      startTicking(eventId);
    }
    return () => stopTicking();
  }, [event?.status, eventId, startTicking, stopTicking]);

  useEffect(() => {
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSeconds = useMemo(() => {
    if (!event) return 20;
    const detected = new Date(event.detectedAt).getTime();
    const expires = new Date(event.cancelWindowExpiresAt).getTime();
    const seconds = Math.round((expires - detected) / 1000);
    return seconds > 0 ? seconds : 20;
  }, [event]);

  const handleCancel = async () => {
    setCancelError(null);
    try {
      await cancelEvent(eventId, 'wearer_app');
    } catch {
      setCancelError('Unable to cancel. Try again.');
    }
  };

  const handleDone = () => {
    router.replace('/(safe-sound)');
  };

  if (isLoading || !event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.cancelButton} />
        {error ? (
          <Text style={[typography.body, { color: palette.textSecondary, marginTop: spacing['4'], textAlign: 'center' }]}>
            {error}
          </Text>
        ) : null}
      </SafeAreaView>
    );
  }

  const detectionLabel = DETECTION_LABEL[event.detectionType];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['6'] }}>
        {event.status === 'COUNTDOWN_ACTIVE' ? (
          <>
            <Text
              style={[typography.h1, { color: palette.textPrimary, textAlign: 'center', marginBottom: spacing['8'] }]}
            >
              {detectionLabel}
            </Text>

            <CountdownRing
              remainingSeconds={remainingSeconds}
              totalSeconds={totalSeconds}
              label={Strings.emergency.cancelHint}
            />

            {event.location.address ? (
              <Text
                style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['6'], textAlign: 'center' }]}
              >
                {event.location.address}
              </Text>
            ) : null}

            {cancelError ? (
              <Text style={[typography.caption, { color: '#EF4444', marginTop: spacing['3'] }]}>{cancelError}</Text>
            ) : null}

            <View style={{ width: '100%', marginTop: spacing['10'] }}>
              <CancelButton onPress={handleCancel} loading={isCancelling} />
            </View>
          </>
        ) : (
          <StatusResolution status={event.status} onDone={handleDone} />
        )}
      </View>
    </SafeAreaView>
  );
}

function StatusResolution({
  status,
  onDone,
}: {
  status: EmergencyStatus;
  onDone: () => void;
}) {
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { textPrimary: string; textSecondary: string; cancelButton: string };

  const { icon, title, subtitle } = (() => {
    switch (status) {
      case 'CANCELLED':
        return { icon: '✅', title: Strings.emergency.cancelled, subtitle: undefined };
      case 'CONTACTS_NOTIFIED':
        return { icon: '📨', title: Strings.emergency.contactsNotified, subtitle: undefined };
      case 'INCIDENT_CREATED':
        return { icon: '🚑', title: Strings.emergency.incidentCreated, subtitle: Strings.emergency.helpOnTheWay };
      case 'ESCALATION_INITIATED':
        return { icon: '📞', title: Strings.emergency.escalationInitiated, subtitle: undefined };
      case 'ESCALATION_CONNECTED':
        return { icon: '🚑', title: Strings.emergency.helpOnTheWay, subtitle: undefined };
      default:
        return { icon: 'ℹ️', title: status, subtitle: undefined };
    }
  })();

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <Text style={{ fontSize: 64 }}>{icon}</Text>
      <Text style={[typography.h1, { color: palette.textPrimary, textAlign: 'center' }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.body, { color: palette.textSecondary, textAlign: 'center' }]}>{subtitle}</Text>
      ) : null}
      <Text
        onPress={onDone}
        style={[typography.button, { color: palette.cancelButton, marginTop: spacing['6'] }]}
      >
        {Strings.common.close}
      </Text>
    </View>
  );
}

export default function EmergencyScreen() {
  return (
    <ThemeProvider product="emergency">
      <EmergencyContent />
    </ThemeProvider>
  );
}

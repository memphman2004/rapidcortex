import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { Sheet } from '@/components/common/Sheet';
import { useDevicesStore } from '@/stores/devices.store';
import { useTheme } from '@/theme';
import { formatPhoneDisplay } from '@/utils/format';
import { Strings } from '@/utils/strings';
import { normalizePhoneToE164, validateRequired } from '@/utils/validation';
import type { EmergencyContact, RCLanguage } from '@/types/mobile';

const RELATIONSHIPS: Array<keyof typeof Strings.emergencyContacts.relationships> = [
  'parent',
  'spouse',
  'child',
  'sibling',
  'friend',
  'caregiver',
  'other',
];

const MAX_CONTACTS = 5;

function emptyContact(): EmergencyContact {
  return {
    contactId: `local-${Date.now()}`,
    ownerId: '',
    name: '',
    phone: '',
    relationship: 'other',
    notifyViaPush: true,
    notifyViaSMS: true,
    notifyViaCall: false,
    canCancelAlert: false,
    preferredLanguage: null,
    preferredLanguageName: null,
    preferredLanguageRTL: false,
  };
}

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; blue: string; red: string };

  const storeContacts = useDevicesStore((state) => state.emergencyContacts);
  const contactsLoading = useDevicesStore((state) => state.contactsLoading);
  const setEmergencyContacts = useDevicesStore((state) => state.setEmergencyContacts);

  const [contacts, setContacts] = useState<EmergencyContact[]>(storeContacts);
  const [editing, setEditing] = useState<EmergencyContact | null>(null);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setContacts(storeContacts);
  }, [storeContacts]);

  const openNewContact = () => {
    if (contacts.length >= MAX_CONTACTS) {
      Alert.alert(Strings.emergencyContacts.title, Strings.emergencyContacts.maxContacts);
      return;
    }
    setFormError(null);
    setEditing(emptyContact());
  };

  const persist = async (next: EmergencyContact[]) => {
    try {
      await setEmergencyContacts(next);
    } catch {
      Alert.alert(Strings.common.somethingWentWrong);
    }
  };

  const handleSaveContact = () => {
    if (!editing) return;
    const nameResult = validateRequired(editing.name, Strings.emergencyContacts.name);
    if (!nameResult.valid) return setFormError(nameResult.error ?? null);

    const normalizedPhone = normalizePhoneToE164(editing.phone);
    if (!normalizedPhone) {
      setFormError('Enter a valid phone number.');
      return;
    }

    const saved: EmergencyContact = { ...editing, phone: normalizedPhone };
    const next = contacts.some((contact) => contact.contactId === saved.contactId)
      ? contacts.map((contact) => (contact.contactId === saved.contactId ? saved : contact))
      : [...contacts, saved];

    setContacts(next);
    setEditing(null);
    void persist(next);
  };

  const handleDeleteContact = (contactId: string) => {
    const next = contacts.filter((contact) => contact.contactId !== contactId);
    setContacts(next);
    void persist(next);
  };

  const handleSelectLanguage = (language: RCLanguage) => {
    setLanguagePickerVisible(false);
    if (!editing) return;
    setEditing({
      ...editing,
      preferredLanguage: language.code,
      preferredLanguageName: language.name,
      preferredLanguageRTL: language.direction === 'rtl',
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing['5'] }}>
        <Text style={[typography.h1, { color: palette.textPrimary }]}>{Strings.emergencyContacts.title}</Text>
        <Text onPress={() => router.back()} style={[typography.label, { color: palette.blue }]}>
          {Strings.common.close}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing['5'], paddingBottom: spacing['10'] }}>
        <Text style={[typography.caption, { color: palette.textSecondary, marginBottom: spacing['4'] }]}>
          {Strings.emergencyContacts.maxContacts}
        </Text>

        {contacts.map((contact) => (
          <Card key={contact.contactId} style={{ marginBottom: spacing['3'] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: palette.textPrimary }]}>{contact.name}</Text>
                <Text style={[typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
                  {formatPhoneDisplay(contact.phone)} · {Strings.emergencyContacts.relationships[contact.relationship as keyof typeof Strings.emergencyContacts.relationships] ?? contact.relationship}
                </Text>
              </View>
              {contact.canCancelAlert ? <Badge label="Can cancel" tone="accent" size="sm" /> : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing['3'] }}>
              {contact.notifyViaPush ? <Badge label={Strings.emergencyContacts.push} tone="neutral" size="sm" /> : null}
              {contact.notifyViaSMS ? <Badge label={Strings.emergencyContacts.sms} tone="neutral" size="sm" /> : null}
              {contact.notifyViaCall ? <Badge label={Strings.emergencyContacts.phoneCall} tone="neutral" size="sm" /> : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 16, marginTop: spacing['3'] }}>
              <Text style={[typography.label, { color: palette.blue }]} onPress={() => { setFormError(null); setEditing(contact); }}>
                {Strings.common.edit}
              </Text>
              <Text style={[typography.label, { color: palette.red }]} onPress={() => handleDeleteContact(contact.contactId)}>
                {Strings.common.delete}
              </Text>
            </View>
          </Card>
        ))}

        <Button title="+ Add Contact" variant="secondary" onPress={openNewContact} disabled={contactsLoading} />
      </ScrollView>

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={Strings.emergencyContacts.title}>
        {editing ? (
          <View style={{ gap: spacing['4'] }}>
            <Input
              label={Strings.emergencyContacts.name}
              value={editing.name}
              onChangeText={(value) => setEditing({ ...editing, name: value })}
              autoCapitalize="words"
            />
            <Input
              label={Strings.emergencyContacts.phone}
              value={editing.phone}
              onChangeText={(value) => setEditing({ ...editing, phone: value })}
              keyboardType="phone-pad"
              placeholder="(555) 000-0000"
            />

            <View>
              <Text style={[typography.label, { color: palette.textPrimary, marginBottom: spacing['2'] }]}>
                {Strings.emergencyContacts.relationship}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {RELATIONSHIPS.map((key) => (
                  <Text
                    key={key}
                    onPress={() => setEditing({ ...editing, relationship: key })}
                    style={{ opacity: editing.relationship === key ? 1 : 0.5 }}
                  >
                    <Badge
                      label={Strings.emergencyContacts.relationships[key]}
                      tone={editing.relationship === key ? 'accent' : 'neutral'}
                      size="sm"
                    />
                  </Text>
                ))}
              </View>
            </View>

            <View>
              <Text style={[typography.label, { color: palette.textPrimary, marginBottom: spacing['2'] }]}>
                {Strings.emergencyContacts.notifyVia}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['1'] }}>
                <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.emergencyContacts.push}</Text>
                <Switch value={editing.notifyViaPush} onValueChange={(value) => setEditing({ ...editing, notifyViaPush: value })} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['1'] }}>
                <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.emergencyContacts.sms}</Text>
                <Switch value={editing.notifyViaSMS} onValueChange={(value) => setEditing({ ...editing, notifyViaSMS: value })} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.emergencyContacts.phoneCall}</Text>
                <Switch value={editing.notifyViaCall} onValueChange={(value) => setEditing({ ...editing, notifyViaCall: value })} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[typography.body, { color: palette.textSecondary, flex: 1, marginRight: 12 }]}>
                {Strings.emergencyContacts.canCancelAlerts}
              </Text>
              <Switch value={editing.canCancelAlert} onValueChange={(value) => setEditing({ ...editing, canCancelAlert: value })} />
            </View>

            <View>
              <Text
                onPress={() => setLanguagePickerVisible(true)}
                style={[typography.body, { color: palette.textPrimary }]}
              >
                {Strings.emergencyContacts.preferredLanguage}: {editing.preferredLanguageName ?? Strings.common.useDeviceLanguage}
              </Text>
              <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['1'] }]}>
                {Strings.emergencyContacts.preferredLanguageHelp}
              </Text>
            </View>

            {formError ? <Text style={[typography.caption, { color: palette.red }]}>{formError}</Text> : null}

            <Button title={Strings.common.save} onPress={handleSaveContact} />
          </View>
        ) : null}
      </Sheet>

      <LanguagePicker
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        selectedCode={editing?.preferredLanguage ?? null}
        onSelect={handleSelectLanguage}
      />
    </SafeAreaView>
  );
}

import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { QRDisplay, type QRCodeRef } from '@/components/venue/QRDisplay';
import { getCode } from '@/services/api/codes';
import { useCodesStore } from '@/stores/codes.store';
import { useTheme } from '@/theme';
import { formatRelativeTime, formatPhoneDisplay } from '@/utils/format';
import { Strings } from '@/utils/strings';
import type { RCCode } from '@/types/mobile';

function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

async function writeQrPng(fileUri: string, dataUrl: string): Promise<void> {
  await FileSystem.writeAsStringAsync(fileUri, base64FromDataUrl(dataUrl), {
    encoding: 'base64',
  });
}

export default function VenueCodeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const palette = colors as { background: string; textPrimary: string; textSecondary: string; amber: string; red: string; emerald: string; border: string };

  const cachedCode = useCodesStore((state) => state.getCodeById(id));
  const patchCode = useCodesStore((state) => state.patchCode);
  const removeCode = useCodesStore((state) => state.removeCode);

  const [code, setCode] = useState<RCCode | null>(cachedCode ?? null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const qrRef = useRef<QRCodeRef | null>(null);

  useEffect(() => {
    void getCode(id).then(setCode).catch(() => undefined);
  }, [id]);

  if (!code) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.common.loading}</Text>
      </SafeAreaView>
    );
  }

  const handleCopyUrl = async () => {
    await Clipboard.setStringAsync(code.reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToPhotos = async () => {
    if (!qrRef.current) return;
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(Strings.common.noPermission);
      return;
    }
    qrRef.current.toDataURL(async (dataUrl) => {
      try {
        const fileUri = `${FileSystem.cacheDirectory}rc-code-${code.codeId}.png`;
        await writeQrPng(fileUri, dataUrl);
        await MediaLibrary.saveToLibraryAsync(fileUri);
        Alert.alert(Strings.venue.signPackage.saveToPhotos, 'Saved to Photos.');
      } catch {
        Alert.alert(Strings.common.somethingWentWrong);
      }
    });
  };

  const handleShareQr = async () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL(async (dataUrl) => {
      try {
        const fileUri = `${FileSystem.cacheDirectory}rc-code-${code.codeId}-share.png`;
        await writeQrPng(fileUri, dataUrl);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'image/png' });
        }
      } catch {
        Alert.alert(Strings.common.somethingWentWrong);
      }
    });
  };

  const handleToggleActive = () => {
    const nextStatus = code.status === 'active' ? 'inactive' : 'active';
    Alert.alert(
      nextStatus === 'inactive' ? Strings.venue.signPackage.deactivateCode : Strings.venue.filters.active,
      undefined,
      [
        { text: Strings.common.cancel, style: 'cancel' },
        {
          text: Strings.common.confirm,
          onPress: async () => {
            setBusy(true);
            try {
              const updated = await patchCode(code.codeId, { status: nextStatus });
              setCode(updated);
            } catch {
              Alert.alert(Strings.common.somethingWentWrong);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(Strings.venue.signPackage.deleteCode, Strings.venue.signPackage.deleteCodeConfirm, [
      { text: Strings.common.cancel, style: 'cancel' },
      {
        text: Strings.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await removeCode(code.codeId);
            router.back();
          } catch {
            Alert.alert(Strings.common.somethingWentWrong);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['5'], paddingTop: spacing['4'] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.amber }]}>‹ Back</Text>
        </Pressable>
        <Badge label={code.status === 'active' ? Strings.venue.filters.active : Strings.venue.filters.inactive} tone={code.status === 'active' ? 'success' : 'neutral'} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing['5'], paddingBottom: spacing['10'] }}>
        <Text style={[typography.label, { color: palette.textSecondary }]}>{Strings.venue.signPackage.signIdentity.toUpperCase()}</Text>
        <Text style={[typography.h1, { color: palette.textPrimary, marginTop: spacing['1'] }]}>{code.name}</Text>
        <Text style={[typography.body, { color: palette.textSecondary, marginTop: spacing['1'] }]}>{code.zone}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing['3'], marginBottom: spacing['5'] }}>
          <Badge label={code.vertical === 'venue' ? Strings.venue.vertical.venue : Strings.venue.vertical.campus} tone="accent" size="sm" />
          <Badge label={Strings.venue.createCode.reportTypes[code.reportType]} tone="neutral" size="sm" />
        </View>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          {Strings.venue.signPackage.qrCode.toUpperCase()}
        </Text>
        <QRDisplay value={code.reportUrl} qrRef={qrRef} />
        <Text style={[typography.caption, { color: palette.textSecondary, textAlign: 'center', marginTop: spacing['3'] }]}>
          {Strings.venue.signPackage.printMinSize}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing['4'], marginBottom: spacing['5'] }}>
          <Button title={Strings.venue.signPackage.saveToPhotos} variant="secondary" onPress={handleSaveToPhotos} />
          <Button title={Strings.venue.signPackage.shareQr} variant="secondary" onPress={handleShareQr} />
        </View>

        <Card onPress={handleCopyUrl} style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[typography.body, { color: palette.textPrimary, flex: 1 }]} numberOfLines={1}>
              {code.reportUrl}
            </Text>
            <Text style={[typography.label, { color: palette.amber }]}>
              {copied ? Strings.common.copied : Strings.venue.signPackage.copyUrl}
            </Text>
          </View>
        </Card>

        {code.smsNumber ? (
          <Card style={{ marginBottom: spacing['5'] }}>
            <Text style={[typography.label, { color: palette.textSecondary }]}>{Strings.venue.signPackage.smsNumber.toUpperCase()}</Text>
            <Text style={[typography.h3, { color: palette.textPrimary, marginTop: spacing['1'] }]}>{formatPhoneDisplay(code.smsNumber)}</Text>
            <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['2'] }]}>{Strings.venue.signPackage.smsHelper}</Text>
          </Card>
        ) : null}

        <Card onPress={() => router.push(`/(venue)/code/${code.codeId}/nfc-write`)} style={{ marginBottom: spacing['3'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.venue.signPackage.nfcTag}</Text>
              <Badge
                label={code.nfcWriteLog.length > 0 ? Strings.venue.nfcWritten : Strings.venue.notProgrammed}
                tone={code.nfcWriteLog.length > 0 ? 'success' : 'warning'}
                size="sm"
              />
            </View>
            <Text style={[typography.label, { color: palette.amber }]}>{Strings.venue.signPackage.programNfc}</Text>
          </View>
        </Card>

        <Card onPress={() => router.push(`/(venue)/code/${code.codeId}/qr-view`)} style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.venue.signPackage.signReference}</Text>
            <Text style={{ color: palette.textSecondary }}>›</Text>
          </View>
        </Card>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          {Strings.venue.signPackage.nfcWriteLog.toUpperCase()}
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          {code.nfcWriteLog.length === 0 ? (
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.venue.signPackage.nfcWriteLogEmpty}</Text>
          ) : (
            code.nfcWriteLog.map((entry, index) => (
              <View
                key={entry.eventId}
                style={{ paddingVertical: spacing['2'], borderTopWidth: index === 0 ? 0 : 1, borderColor: palette.border }}
              >
                <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>
                  {entry.writtenByName ?? entry.writtenBy}
                </Text>
                <Text style={[typography.caption, { color: palette.textSecondary }]}>
                  {formatRelativeTime(entry.writtenAt)} · {entry.devicePlatform} · {entry.bytesWritten} bytes
                </Text>
              </View>
            ))
          )}
        </Card>

        <Text style={[typography.label, { color: palette.textSecondary, marginBottom: spacing['2'] }]}>
          {Strings.venue.signPackage.engagementMetrics.toUpperCase()}
        </Text>
        <Card style={{ marginBottom: spacing['5'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.venue.signPackage.nfcTaps}</Text>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{code.metrics.nfcTaps}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['2'] }}>
            <Text style={[typography.body, { color: palette.textSecondary }]}>{Strings.venue.signPackage.qrScans}</Text>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{code.metrics.qrScans}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['2'], borderTopWidth: 1, borderColor: palette.border, paddingTop: spacing['2'] }}>
            <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>{Strings.venue.signPackage.totalActivity}</Text>
            <Text style={[typography.bodyMedium, { color: palette.amber }]}>{code.metrics.nfcTaps + code.metrics.qrScans}</Text>
          </View>
        </Card>

        <Text style={[typography.label, { color: palette.red, marginBottom: spacing['2'] }]}>
          {Strings.venue.signPackage.dangerZone.toUpperCase()}
        </Text>
        <Button
          title={code.status === 'active' ? Strings.venue.signPackage.deactivateCode : Strings.venue.filters.active}
          variant="secondary"
          onPress={handleToggleActive}
          disabled={busy}
        />
        <View style={{ height: spacing['3'] }} />
        <Button title={Strings.venue.signPackage.deleteCode} variant="danger" onPress={handleDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

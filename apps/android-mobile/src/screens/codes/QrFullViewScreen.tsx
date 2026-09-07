import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { QRDisplay, type QRCodeRef } from '@/components/venue/QRDisplay';
import { getCode } from '@/services/api/codes';
import { Strings } from '@/utils/strings';
import { formatPhoneDisplay } from '@/utils/format';
import type { RCCode } from '@/types/mobile';

export default function QrFullViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [code, setCode] = useState<RCCode | null>(null);
  const qrRef = useRef<QRCodeRef | null>(null);

  useEffect(() => {
    void getCode(id).then(setCode).catch(() => undefined);
  }, [id]);

  const handleShare = async () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL(async (dataUrl) => {
      try {
        const fileUri = `${FileSystem.cacheDirectory}rc-sign-${id}.png`;
        const comma = dataUrl.indexOf(',');
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: 'base64' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'image/png' });
        }
      } catch {
        Alert.alert(Strings.common.somethingWentWrong);
      }
    });
  };

  if (!code) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6B7280' }}>{Strings.common.loading}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: '#1B4FD8', fontSize: 17, fontWeight: '600' }}>{Strings.common.close}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 24, paddingBottom: 48 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 1 }}>
          {code.vertical === 'venue' ? Strings.venue.vertical.venue : Strings.venue.vertical.campus} SAFETY REPORTING
        </Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#0A0F1E', marginTop: 8, textAlign: 'center' }}>
          {code.name}
        </Text>
        <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 4, marginBottom: 24 }}>{code.zone}</Text>

        <QRDisplay value={code.reportUrl} size={260} qrRef={qrRef} />

        <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 16, textAlign: 'center' }}>
          {Strings.venue.signPackage.printMinSize}
        </Text>

        <View style={{ width: '100%', marginTop: 32, borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 20 }}>
          <Text style={{ fontSize: 13, color: '#6B7280' }}>{Strings.venue.signPackage.nfcTag}</Text>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#0A0F1E', marginTop: 2 }}>
            {code.nfcWriteLog.length > 0 ? Strings.venue.nfcWritten : Strings.venue.notProgrammed}
          </Text>
        </View>

        {code.smsNumber ? (
          <View style={{ width: '100%', marginTop: 16 }}>
            <Text style={{ fontSize: 13, color: '#6B7280' }}>{Strings.venue.signPackage.smsNumber}</Text>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#0A0F1E', marginTop: 2 }}>
              {formatPhoneDisplay(code.smsNumber)}
            </Text>
          </View>
        ) : null}

        <View style={{ width: '100%', marginTop: 32 }}>
          <Button title={Strings.venue.signPackage.shareSignPackage} onPress={handleShare} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

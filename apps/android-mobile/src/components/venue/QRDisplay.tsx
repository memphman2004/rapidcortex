import type { MutableRefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/theme';

/** Center mark for printed / shared QR artwork (NexCort iQ brand). */
const QR_CENTER_LOGO = require('../../../assets/icon.png') as number;

export interface QRCodeRef {
  toDataURL: (callback: (dataUrl: string) => void) => void;
}

export interface QRDisplayProps {
  value: string;
  size?: number;
  qrRef?: MutableRefObject<QRCodeRef | null>;
}

export function QRDisplay({ value, size = 220, qrRef }: QRDisplayProps) {
  const { borderRadius, spacing } = useTheme();
  const logoSize = Math.round(size * 0.22);

  return (
    <View
      style={[
        styles.box,
        { borderRadius: borderRadius.xl, padding: spacing['5'] },
      ]}
    >
      <QRCode
        value={value}
        size={size}
        color="#0A0F1E"
        backgroundColor="#FFFFFF"
        ecl="H"
        logo={QR_CENTER_LOGO}
        logoSize={logoSize}
        logoMargin={2}
        logoBorderRadius={6}
        logoBackgroundColor="#FFFFFF"
        getRef={(component) => {
          if (qrRef) {
            qrRef.current = component as unknown as QRCodeRef;
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
  },
});

import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ visible, onClose, title, children, footer }: ModalProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const palette = colors as {
    background: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={styles.centerWrap}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: borderRadius.xl,
                padding: spacing['5'],
              },
            ]}
          >
            {title ? (
              <View style={[styles.header, { marginBottom: spacing['4'] }]}>
                <Text style={[typography.h3, { color: palette.textPrimary, flex: 1 }]}>
                  {title}
                </Text>
                <Pressable onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
                  <Text style={[typography.h3, { color: palette.textSecondary }]}>×</Text>
                </Pressable>
              </View>
            ) : null}
            {children}
            {footer ? <View style={{ marginTop: spacing['5'] }}>{footer}</View> : null}
          </View>
        </SafeAreaView>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
  },
  centerWrap: {
    paddingHorizontal: 20,
  },
  card: {
    borderWidth: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

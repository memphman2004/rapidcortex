import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function Sheet({ visible, onClose, title, children, maxHeightRatio = 0.85 }: SheetProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const palette = colors as {
    surface: string;
    border: string;
    textPrimary: string;
    textMuted: string;
  };

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : SCREEN_HEIGHT,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <RNModal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderTopLeftRadius: borderRadius['2xl'],
              borderTopRightRadius: borderRadius['2xl'],
              maxHeight: SCREEN_HEIGHT * maxHeightRatio,
              transform: [{ translateY }],
            },
          ]}
        >
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: palette.textMuted }]} />
            </View>
            {title ? (
              <Text
                style={[
                  typography.h3,
                  { color: palette.textPrimary, paddingHorizontal: spacing['5'], marginBottom: spacing['3'] },
                ]}
              >
                {title}
              </Text>
            ) : null}
            <View style={{ paddingHorizontal: spacing['5'], paddingBottom: spacing['6'] }}>
              {children}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
});

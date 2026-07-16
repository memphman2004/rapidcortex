import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/theme';
import { Strings } from '@/utils/strings';
import { Badge } from './Badge';
import { Input } from './Input';
import { Sheet } from './Sheet';
import type { RCLanguage } from '@/types/mobile';

export interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
  selectedCode: string | null;
  onSelect: (language: RCLanguage) => void;
}

export function LanguagePicker({ visible, onClose, selectedCode, onSelect }: LanguagePickerProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const palette = colors as {
    border: string;
    textPrimary: string;
    textSecondary: string;
    surfaceAlt: string;
  };
  const { translatableLanguages, isLoading, error, detectedDeviceLanguage } = useLanguage();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return translatableLanguages;
    return translatableLanguages.filter(
      (language) =>
        language.name.toLowerCase().includes(trimmed) ||
        (language.nativeName ?? '').toLowerCase().includes(trimmed) ||
        language.code.toLowerCase().includes(trimmed),
    );
  }, [translatableLanguages, query]);

  return (
    <Sheet visible={visible} onClose={onClose} title={Strings.language.pickerTitle}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={Strings.language.searchPlaceholder}
        autoCorrect={false}
      />

      {error ? (
        <Text style={[typography.caption, { color: palette.textSecondary, marginTop: spacing['3'] }]}>
          {Strings.language.unavailable}
        </Text>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        style={{ marginTop: spacing['3'], maxHeight: 420 }}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={[typography.body, { color: palette.textSecondary, paddingVertical: spacing['4'] }]}>
              {Strings.language.noResults(query)}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const isSelected = item.code === selectedCode;
          const isDetected = detectedDeviceLanguage?.code === item.code;
          return (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing['3'],
                  paddingHorizontal: spacing['3'],
                  borderRadius: borderRadius.md,
                  backgroundColor: isSelected ? palette.surfaceAlt : pressed ? palette.surfaceAlt : 'transparent',
                  gap: 8,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: palette.textPrimary }]}>
                  {item.name}
                  {item.nativeName ? ` · ${item.nativeName}` : ''}
                </Text>
                {isDetected ? (
                  <Text style={[typography.caption, { color: palette.textSecondary }]}>
                    {Strings.language.detected}
                  </Text>
                ) : null}
              </View>
              {item.direction === 'rtl' ? <Badge label={Strings.language.rtlBadge} tone="neutral" size="sm" /> : null}
              {isSelected ? <Badge label="✓" tone="accent" size="sm" /> : null}
            </Pressable>
          );
        }}
      />

      <Text
        style={[
          typography.caption,
          { color: palette.textSecondary, textAlign: 'center', marginTop: spacing['3'] },
        ]}
      >
        {Strings.language.poweredBy}
      </Text>
    </Sheet>
  );
}

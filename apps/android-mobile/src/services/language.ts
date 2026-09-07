import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { get } from './api/client';
import type { LanguageRegistryResponse, RCLanguage } from '../types/mobile';

const LANGUAGE_CACHE_KEY = 'rc_language_registry';
const LANGUAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface LanguageRegistryCache {
  languages: RCLanguage[];
  primaryProvider: string;
  fallbackProvider: string;
  count: number;
  cachedAt: string;
}

function normalizeLanguageEntry(entry: RCLanguage): RCLanguage {
  return {
    ...entry,
    direction: entry.direction === 'rtl' ? 'rtl' : 'ltr',
    capabilities: {
      speechToText: Boolean(entry.capabilities?.speechToText),
      translation: Boolean(entry.capabilities?.translation),
    },
  };
}

/**
 * Fetch the RC language registry from cache or API.
 * Primary: azure-translator. Fallback: google-translate.
 */
export async function fetchLanguageRegistry(): Promise<LanguageRegistryCache> {
  try {
    const cached = await AsyncStorage.getItem(LANGUAGE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as LanguageRegistryCache;
      const age = Date.now() - new Date(parsed.cachedAt).getTime();
      if (age < LANGUAGE_CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {
    // Cache miss or parse error — continue to fetch.
  }

  const response = await get<LanguageRegistryResponse>(
    '/api/call-intelligence/languages',
  );

  if (!response.data.ok) {
    throw new Error('Language registry request failed');
  }

  const registry: LanguageRegistryCache = {
    languages: response.data.languages.map(normalizeLanguageEntry),
    primaryProvider: response.data.primaryProvider,
    fallbackProvider: response.data.fallbackProvider,
    count: response.data.count,
    cachedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(LANGUAGE_CACHE_KEY, JSON.stringify(registry));
  return registry;
}

/**
 * Detect the device's primary locale and map it to an RC-supported language.
 */
export function detectDeviceLanguage(registry: RCLanguage[]): RCLanguage | null {
  const locales = Localization.getLocales();
  if (!locales.length) return null;

  const primary = locales[0];

  let match = registry.find((language) => language.code === primary.languageTag);
  if (!match && primary.languageCode) {
    match = registry.find((language) => language.code === primary.languageCode);
  }

  return match?.capabilities.translation ? match : null;
}

/** Languages where translation is supported — used for pickers. */
export function getTranslatableLanguages(registry: RCLanguage[]): RCLanguage[] {
  return registry
    .filter((language) => language.capabilities.translation)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True when the BCP-47 code is tagged RTL in the RC registry. */
export function isRTLLanguage(code: string, registry: RCLanguage[]): boolean {
  const normalized = code.trim().toLowerCase();
  return (
    registry.find((language) => language.code.toLowerCase() === normalized)
      ?.direction === 'rtl'
  );
}

export async function clearLanguageRegistryCache(): Promise<void> {
  await AsyncStorage.removeItem(LANGUAGE_CACHE_KEY);
}

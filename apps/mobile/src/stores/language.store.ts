import { create } from 'zustand';
import {
  fetchLanguageRegistry,
  getTranslatableLanguages,
} from '../services/language';
import type { RCLanguage } from '../types/mobile';

interface LanguageStoreState {
  languages: RCLanguage[];
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  primaryProvider: string;
  fallbackProvider: string;
  totalCount: number;

  load: () => Promise<void>;
  getLanguageByCode: (code: string) => RCLanguage | undefined;
  getSupportedTranslationLanguages: () => RCLanguage[];
}

export const useLanguageStore = create<LanguageStoreState>((set, get) => ({
  languages: [],
  isLoaded: false,
  isLoading: false,
  error: null,
  primaryProvider: 'azure-translator',
  fallbackProvider: 'google-translate',
  totalCount: 0,

  load: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const registry = await fetchLanguageRegistry();
      set({
        languages: registry.languages,
        isLoaded: true,
        isLoading: false,
        primaryProvider: registry.primaryProvider,
        fallbackProvider: registry.fallbackProvider,
        totalCount: registry.count,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Language registry unavailable';
      set({
        isLoading: false,
        error: message,
      });
    }
  },

  getLanguageByCode: (code) => {
    const normalized = code.trim().toLowerCase();
    return get().languages.find(
      (language) => language.code.toLowerCase() === normalized,
    );
  },

  getSupportedTranslationLanguages: () => {
    return getTranslatableLanguages(get().languages);
  },
}));

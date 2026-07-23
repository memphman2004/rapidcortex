import { useEffect } from 'react';
import { detectDeviceLanguage } from '../services/language';
import { useLanguageStore } from '../stores/language.store';

export function useLanguage() {
  const languages = useLanguageStore((state) => state.languages);
  const isLoaded = useLanguageStore((state) => state.isLoaded);
  const isLoading = useLanguageStore((state) => state.isLoading);
  const error = useLanguageStore((state) => state.error);
  const totalCount = useLanguageStore((state) => state.totalCount);
  const primaryProvider = useLanguageStore((state) => state.primaryProvider);
  const load = useLanguageStore((state) => state.load);
  const getLanguageByCode = useLanguageStore((state) => state.getLanguageByCode);
  const getSupportedTranslationLanguages = useLanguageStore(
    (state) => state.getSupportedTranslationLanguages,
  );

  useEffect(() => {
    if (!isLoaded && !isLoading) {
      void load();
    }
  }, [isLoaded, isLoading, load]);

  const detectedDeviceLanguage = isLoaded
    ? detectDeviceLanguage(languages)
    : null;

  const translatableLanguages = isLoaded
    ? getSupportedTranslationLanguages()
    : [];

  return {
    languages,
    isLoaded,
    isLoading,
    error,
    totalCount,
    primaryProvider,
    detectedDeviceLanguage,
    getLanguageByCode,
    translatableLanguages,
    reload: load,
  };
}

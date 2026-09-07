import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import {
  authenticate as biometricAuthenticate,
  isBiometricAvailable,
} from '../services/biometric';
import {
  buildUserContextFromSession,
  clearMemoryAccessToken,
  confirmSignUp as authConfirmSignUp,
  getSecureRefreshTokenKey,
  refresh as authRefresh,
  refreshFromStoredToken,
  restoreSessionFromAmplify,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  type CognitoSession,
  type RCUserContext,
} from '../services/api/auth';
import { isSafeSoundPublicEnabled } from '../utils/feature-flags';

export type ProductPath = 'safe-sound' | 'venue' | 'campus';

const SECURE_PRODUCT_PATH_KEY = 'rc_mobile_product_path';
const SECURE_BIOMETRIC_ENABLED_KEY = 'rc_mobile_biometric_enabled';
const SECURE_PREFERRED_LANGUAGE_KEY = 'rc_mobile_preferred_language';

function normalizeStoredProductPath(raw: string | null): ProductPath | null {
  if (raw === 'venue-campus') return 'venue';
  if (raw === 'safe-sound') {
    return isSafeSoundPublicEnabled() ? 'safe-sound' : null;
  }
  if (raw === 'venue' || raw === 'campus') return raw;
  return null;
}

interface AuthStoreState {
  session: CognitoSession | null;
  user: RCUserContext | null;
  productPath: ProductPath | null;
  isLoading: boolean;
  error: string | null;
  biometricEnabled: boolean;

  setProductPath: (path: ProductPath) => Promise<void>;
  clearProductPath: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  authenticateBiometric: () => Promise<boolean>;
  clearError: () => void;
  hydrateFromSecureStore: () => Promise<void>;
  setPreferredLanguage: (languageCode: string | null) => Promise<void>;
}

async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeSecure(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function deleteSecure(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore delete failures on cold start.
  }
}

function applyPreferredLanguage(
  user: RCUserContext,
  preferredLanguage: string | null,
): RCUserContext {
  return {
    ...user,
    preferredLanguage,
  };
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  session: null,
  user: null,
  productPath: null,
  isLoading: false,
  error: null,
  biometricEnabled: false,

  setProductPath: async (path) => {
    await writeSecure(SECURE_PRODUCT_PATH_KEY, path);
    set({ productPath: path });
  },

  clearProductPath: async () => {
    await deleteSecure(SECURE_PRODUCT_PATH_KEY);
    set({ productPath: null });
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const preferredLanguage = await readSecure(SECURE_PREFERRED_LANGUAGE_KEY);
      const { session, user, refreshToken } = await authSignIn(email, password);
      if (refreshToken) {
        await writeSecure(getSecureRefreshTokenKey(), refreshToken);
      }

      set({
        session,
        user: applyPreferredLanguage(user, preferredLanguage),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-in failed';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  signUp: async (email, password, firstName, lastName) => {
    set({ isLoading: true, error: null });
    try {
      await authSignUp(email, password, firstName, lastName);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-up failed';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  confirmSignUp: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      await authConfirmSignUp(email, code);
      set({ isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Verification failed';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      await authSignOut();
    } finally {
      clearMemoryAccessToken();
      await deleteSecure(getSecureRefreshTokenKey());
      set({
        session: null,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  },

  refreshSession: async () => {
    try {
      const preferredLanguage = await readSecure(SECURE_PREFERRED_LANGUAGE_KEY);
      const storedRefreshToken = await readSecure(getSecureRefreshTokenKey());

      if (storedRefreshToken) {
        const refreshed = await refreshFromStoredToken(
          storedRefreshToken,
          preferredLanguage,
        );
        set({
          session: refreshed.session,
          user: refreshed.user,
        });
        return;
      }

      const restored = await restoreSessionFromAmplify(preferredLanguage);
      if (!restored) {
        const refreshed = await authRefresh();
        if (refreshed.refreshToken) {
          await writeSecure(getSecureRefreshTokenKey(), refreshed.refreshToken);
        }
        set({
          session: refreshed.session,
          user: applyPreferredLanguage(refreshed.user, preferredLanguage),
        });
        return;
      }

      if (restored.refreshToken) {
        await writeSecure(getSecureRefreshTokenKey(), restored.refreshToken);
      }

      set({
        session: restored.session,
        user: applyPreferredLanguage(restored.user, preferredLanguage),
      });
    } catch (error) {
      await get().signOut();
      throw error;
    }
  },

  enableBiometric: async () => {
    const available = await isBiometricAvailable();
    if (!available) {
      throw new Error('Biometric authentication is not available on this device.');
    }
    await writeSecure(SECURE_BIOMETRIC_ENABLED_KEY, 'true');
    set({ biometricEnabled: true });
  },

  authenticateBiometric: async () => {
    if (!get().biometricEnabled) return true;
    return biometricAuthenticate('Unlock Rapid Cortex');
  },

  clearError: () => set({ error: null }),

  hydrateFromSecureStore: async () => {
    // Intentionally does not toggle global isLoading — root layout must stay mounted.
    try {
      const [productPathRaw, biometricRaw, preferredLanguage, refreshToken] =
        await Promise.all([
          readSecure(SECURE_PRODUCT_PATH_KEY),
          readSecure(SECURE_BIOMETRIC_ENABLED_KEY),
          readSecure(SECURE_PREFERRED_LANGUAGE_KEY),
          readSecure(getSecureRefreshTokenKey()),
        ]);

      const productPath = normalizeStoredProductPath(productPathRaw);

      set({
        productPath,
        biometricEnabled: biometricRaw === 'true',
      });

      if (!refreshToken) {
        return;
      }

      try {
        const restored = await refreshFromStoredToken(
          refreshToken,
          preferredLanguage,
        );

        if (get().biometricEnabled) {
          const passed = await biometricAuthenticate('Unlock Rapid Cortex');
          if (!passed) {
            return;
          }
        }

        set({
          session: restored.session,
          user: restored.user,
        });
        return;
      } catch {
        const restored = await restoreSessionFromAmplify(preferredLanguage);
        if (!restored) {
          return;
        }

        if (get().biometricEnabled) {
          const passed = await biometricAuthenticate('Unlock Rapid Cortex');
          if (!passed) {
            return;
          }
        }

        set({
          session: restored.session,
          user: applyPreferredLanguage(restored.user, preferredLanguage),
        });
        return;
      }
    } catch {
      // Cold start without a restorable session is fine.
    }
  },

  setPreferredLanguage: async (languageCode) => {
    const currentUser = get().user;
    if (languageCode) {
      await writeSecure(SECURE_PREFERRED_LANGUAGE_KEY, languageCode);
    } else {
      await deleteSecure(SECURE_PREFERRED_LANGUAGE_KEY);
    }

    if (!currentUser) return;

    const nextUser = applyPreferredLanguage(currentUser, languageCode);
    set({ user: nextUser });

    if (get().session?.accessToken.jwtToken) {
      set({
        user: buildUserContextFromSession(get().session!, languageCode),
      });
    }
  },
}));

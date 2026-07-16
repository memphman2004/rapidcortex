import { useCallback, useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { isVenueCampusRole } from '../utils/roles';

export function useAuth() {
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const productPath = useAuthStore((state) => state.productPath);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const biometricEnabled = useAuthStore((state) => state.biometricEnabled);

  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const confirmSignUp = useAuthStore((state) => state.confirmSignUp);
  const signOut = useAuthStore((state) => state.signOut);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const setProductPath = useAuthStore((state) => state.setProductPath);
  const enableBiometric = useAuthStore((state) => state.enableBiometric);
  const authenticateBiometric = useAuthStore((state) => state.authenticateBiometric);
  const clearError = useAuthStore((state) => state.clearError);
  const hydrateFromSecureStore = useAuthStore((state) => state.hydrateFromSecureStore);
  const setPreferredLanguage = useAuthStore((state) => state.setPreferredLanguage);

  useEffect(() => {
    void hydrateFromSecureStore();
  }, [hydrateFromSecureStore]);

  const isAuthenticated = Boolean(session?.accessToken.jwtToken);
  const role = user?.['custom:role'] ?? '';
  const agencyId = user?.['custom:agencyId'] ?? '';
  const vertical = user?.['custom:vertical'] ?? null;

  const canAccessVenueCampus = useCallback(() => {
    return isVenueCampusRole(role);
  }, [role]);

  return {
    session,
    user,
    productPath,
    isLoading,
    error,
    biometricEnabled,
    isAuthenticated,
    role,
    agencyId,
    vertical,
    preferredLanguage: user?.preferredLanguage ?? null,
    canAccessVenueCampus,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    refreshSession,
    setProductPath,
    enableBiometric,
    authenticateBiometric,
    clearError,
    setPreferredLanguage,
  };
}

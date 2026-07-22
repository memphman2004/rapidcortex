import { Amplify } from 'aws-amplify';
import {
  confirmSignUp as amplifyConfirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from 'aws-amplify/auth';

export interface RCUserContext {
  sub: string;
  email: string;
  'custom:role': string;
  'custom:agencyId': string;
  'custom:vertical': string | null;
  'cognito:groups': string[];
  preferredLanguage: string | null;
}

export interface CognitoAccessToken {
  jwtToken: string;
  expiresAt: number;
  isExpired(): boolean;
}

export interface CognitoSession {
  accessToken: CognitoAccessToken;
  idToken?: string;
}

interface JwtPayload {
  sub?: string;
  email?: string;
  'custom:role'?: string;
  'custom:agencyId'?: string;
  'custom:vertical'?: string;
  'cognito:groups'?: string | string[];
  preferred_language?: string;
  exp?: number;
}

const SECURE_REFRESH_TOKEN_KEY = 'rc_mobile_refresh_token';

let configured = false;
let memoryAccessToken: string | null = null;
let memoryAccessTokenExpiresAt = 0;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function getMobileClientId(): string {
  return (
    getOptionalEnv('EXPO_PUBLIC_COGNITO_MOBILE_CLIENT_ID') ??
    getOptionalEnv('EXPO_PUBLIC_COGNITO_CLIENT_ID') ??
    ''
  );
}

export function configureAmplifyAuth(): void {
  if (configured) return;

  const userPoolId = getEnv('EXPO_PUBLIC_COGNITO_USER_POOL_ID');
  const userPoolClientId = getMobileClientId();
  if (!userPoolClientId) {
    throw new Error(
      'Missing EXPO_PUBLIC_COGNITO_MOBILE_CLIENT_ID (or EXPO_PUBLIC_COGNITO_CLIENT_ID)',
    );
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          email: true,
        },
      },
    },
  });

  configured = true;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(normalized + padding);
  }
  throw new Error('Base64 decode is unavailable in this runtime');
}

export function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT format');
  }
  const json = decodeBase64Url(parts[1]);
  return JSON.parse(json) as JwtPayload;
}

function normalizeGroups(groups: string | string[] | undefined): string[] {
  if (!groups) return [];
  if (Array.isArray(groups)) return groups.map(String);
  return [String(groups)];
}

export function buildUserContextFromTokens(
  token: string,
  preferredLanguage: string | null = null,
): RCUserContext {
  const payload = decodeJwtPayload(token);
  if (!payload.sub) {
    throw new Error('JWT missing sub claim');
  }

  return {
    sub: payload.sub,
    email: payload.email ?? '',
    'custom:role': payload['custom:role'] ?? '',
    'custom:agencyId': payload['custom:agencyId'] ?? '',
    'custom:vertical': payload['custom:vertical'] ?? null,
    'cognito:groups': normalizeGroups(payload['cognito:groups']),
    preferredLanguage,
  };
}

/** Prefer ID token claims (role/agency); fall back to access token. */
export function buildUserContextFromSession(
  session: CognitoSession,
  preferredLanguage: string | null = null,
): RCUserContext {
  const token = session.idToken?.trim() || session.accessToken.jwtToken;
  return buildUserContextFromTokens(token, preferredLanguage);
}

function createAccessToken(jwtToken: string, expiresAt: number): CognitoAccessToken {
  return {
    jwtToken,
    expiresAt,
    isExpired() {
      return Date.now() >= expiresAt - 30_000;
    },
  };
}

function rememberAccessToken(jwtToken: string, expiresAt: number): void {
  memoryAccessToken = jwtToken;
  memoryAccessTokenExpiresAt = expiresAt;
}

export function getMemoryAccessToken(): string | null {
  if (!memoryAccessToken) return null;
  if (Date.now() >= memoryAccessTokenExpiresAt - 30_000) {
    return null;
  }
  return memoryAccessToken;
}

export function clearMemoryAccessToken(): void {
  memoryAccessToken = null;
  memoryAccessTokenExpiresAt = 0;
}

export function getSecureRefreshTokenKey(): string {
  return SECURE_REFRESH_TOKEN_KEY;
}

function mapCognitoError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const name = (error as Error & { name?: string }).name ?? '';
  const message = error.message ?? '';

  if (name === 'UserNotConfirmedException') {
    return 'Please verify your email first. We can resend the code.';
  }
  if (name === 'NotAuthorizedException') {
    return 'Incorrect email or password.';
  }
  if (name === 'UsernameExistsException') {
    return 'An account with this email already exists.';
  }
  if (name === 'InvalidPasswordException') {
    return message || 'Password does not meet requirements.';
  }
  if (name === 'CodeMismatchException') {
    return 'Invalid verification code. Please try again.';
  }
  if (name === 'ExpiredCodeException') {
    return 'Verification code expired. Request a new code.';
  }
  if (message.toLowerCase().includes('network')) {
    return 'Unable to connect. Check your internet connection and try again.';
  }

  return message || 'Authentication failed. Please try again.';
}

interface CognitoRefreshResponse {
  AuthenticationResult?: {
    AccessToken?: string;
    IdToken?: string;
    ExpiresIn?: number;
    TokenType?: string;
  };
  __type?: string;
  message?: string;
}

async function refreshWithCognitoToken(refreshToken: string): Promise<{
  session: CognitoSession;
  user: RCUserContext;
}> {
  const region = getEnv('EXPO_PUBLIC_COGNITO_REGION');
  const clientId = getMobileClientId();
  if (!clientId) {
    throw new Error('Cognito mobile client id is not configured');
  }

  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    }),
  });

  const payload = (await response.json()) as CognitoRefreshResponse;
  const accessToken = payload.AuthenticationResult?.AccessToken;
  if (!accessToken) {
    throw new Error(payload.message ?? 'Unable to refresh session');
  }

  const expiresIn = payload.AuthenticationResult?.ExpiresIn ?? 3600;
  const expiresAt = Date.now() + expiresIn * 1000;
  rememberAccessToken(accessToken, expiresAt);

  const session: CognitoSession = {
    accessToken: createAccessToken(accessToken, expiresAt),
    idToken: payload.AuthenticationResult?.IdToken,
  };

  return {
    session,
    user: buildUserContextFromSession(session),
  };
}

export async function refreshFromStoredToken(
  refreshToken: string,
  preferredLanguage: string | null = null,
): Promise<{
  session: CognitoSession;
  user: RCUserContext;
  refreshToken: string;
}> {
  const refreshed = await refreshWithCognitoToken(refreshToken);
  return {
    ...refreshed,
    user: buildUserContextFromSession(refreshed.session, preferredLanguage),
    refreshToken,
  };
}

async function sessionFromAmplify(): Promise<{
  session: CognitoSession;
  refreshToken: string | null;
}> {
  const authSession = await fetchAuthSession({ forceRefresh: false });
  const access = authSession.tokens?.accessToken;
  if (!access) {
    throw new Error('No active Cognito session');
  }

  const jwtToken = access.toString();
  const expiresAt = access.payload.exp
    ? access.payload.exp * 1000
    : Date.now() + 55 * 60 * 1000;

  rememberAccessToken(jwtToken, expiresAt);

  const refreshToken =
    typeof authSession.tokens?.idToken === 'undefined'
      ? null
      : (authSession as { tokens?: { refreshToken?: { toString(): string } } })
          .tokens?.refreshToken?.toString() ?? null;

  return {
    session: {
      accessToken: createAccessToken(jwtToken, expiresAt),
      idToken: authSession.tokens?.idToken?.toString(),
    },
    refreshToken,
  };
}

export async function signIn(email: string, password: string): Promise<{
  session: CognitoSession;
  user: RCUserContext;
  refreshToken: string | null;
}> {
  configureAmplifyAuth();

  try {
    const result = await amplifySignIn({
      username: email.trim().toLowerCase(),
      password,
    });

    if (result.isSignedIn) {
      await getCurrentUser();
      const { session, refreshToken } = await sessionFromAmplify();
      const user = buildUserContextFromSession(session);
      return { session, user, refreshToken };
    }

    if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
      throw Object.assign(new Error('Please verify your email first.'), {
        name: 'UserNotConfirmedException',
      });
    }

    throw new Error('Sign-in requires additional steps that are not supported on mobile.');
  } catch (error) {
    throw new Error(mapCognitoError(error));
  }
}

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<{ isSignUpComplete: boolean; nextStep: string }> {
  configureAmplifyAuth();

  try {
    const result = await amplifySignUp({
      username: email.trim().toLowerCase(),
      password,
      options: {
        userAttributes: {
          email: email.trim().toLowerCase(),
          given_name: firstName.trim(),
          family_name: lastName.trim(),
        },
      },
    });

    return {
      isSignUpComplete: result.isSignUpComplete,
      nextStep: result.nextStep.signUpStep,
    };
  } catch (error) {
    throw new Error(mapCognitoError(error));
  }
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  configureAmplifyAuth();

  try {
    await amplifyConfirmSignUp({
      username: email.trim().toLowerCase(),
      confirmationCode: code.trim(),
    });
  } catch (error) {
    throw new Error(mapCognitoError(error));
  }
}

export async function signOut(): Promise<void> {
  configureAmplifyAuth();
  clearMemoryAccessToken();
  try {
    await amplifySignOut();
  } catch {
    // Local session cleanup still proceeds when remote sign-out fails.
  }
}

export async function refresh(): Promise<{
  session: CognitoSession;
  user: RCUserContext;
  refreshToken: string | null;
}> {
  configureAmplifyAuth();

  try {
    const authSession = await fetchAuthSession({ forceRefresh: true });
    const access = authSession.tokens?.accessToken;
    if (access) {
      const jwtToken = access.toString();
      const expiresAt = access.payload.exp
        ? access.payload.exp * 1000
        : Date.now() + 55 * 60 * 1000;

      rememberAccessToken(jwtToken, expiresAt);

      const refreshToken =
        (authSession as { tokens?: { refreshToken?: { toString(): string } } })
          .tokens?.refreshToken?.toString() ?? null;

      const session: CognitoSession = {
        accessToken: createAccessToken(jwtToken, expiresAt),
        idToken: authSession.tokens?.idToken?.toString(),
      };

      return {
        session,
        user: buildUserContextFromSession(session),
        refreshToken,
      };
    }

    throw new Error('Unable to refresh session');
  } catch (error) {
    throw new Error(mapCognitoError(error));
  }
}

export async function restoreSessionFromAmplify(
  preferredLanguage: string | null = null,
): Promise<{
  session: CognitoSession;
  user: RCUserContext;
  refreshToken: string | null;
} | null> {
  configureAmplifyAuth();

  try {
    await getCurrentUser();
    const { session, refreshToken } = await sessionFromAmplify();
    const user = buildUserContextFromSession(session, preferredLanguage);
    return { session, user, refreshToken };
  } catch {
    return null;
  }
}

/** Bearer token for background API calls — prefers Cognito ID token (custom claims). */
export async function getBackgroundAccessToken(): Promise<string | null> {
  configureAmplifyAuth();

  try {
    const refreshed = await refresh();
    return refreshed.session.idToken?.trim() || refreshed.session.accessToken.jwtToken;
  } catch {
    return getMemoryAccessToken();
  }
}

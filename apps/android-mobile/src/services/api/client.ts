import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../stores/auth.store';

const DEFAULT_TIMEOUT_MS = 15_000;

const STACK2_PATH_TESTS: RegExp[] = [
  /^\/api\/call-intelligence\//,
  /^\/api\/languages\//,
];

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function readExtraEnv(name: string): string {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return extra[name]?.trim() ?? '';
}

function getApiBase(): string {
  return trimTrailingSlash(readExtraEnv('EXPO_PUBLIC_API_BASE'));
}

function getApiBase2(): string | undefined {
  const value = readExtraEnv('EXPO_PUBLIC_API_BASE_2');
  return value ? trimTrailingSlash(value) : undefined;
}

function normalizePath(path: string): string {
  if (path.startsWith('/')) return path;
  return `/${path}`;
}

/**
 * Routes mobile API calls to the correct Rapid Cortex API Gateway base.
 * Stack 2 (comms / call-intelligence) when configured; otherwise primary base.
 */
export function resolveApiBase(path: string): string {
  const normalized = normalizePath(path);
  const primary = getApiBase();
  const secondary = getApiBase2();

  if (STACK2_PATH_TESTS.some((pattern) => pattern.test(normalized))) {
    return secondary ?? primary;
  }

  return primary;
}

const apiClient: AxiosInstance = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const path = config.url ?? '/';
  config.baseURL = resolveApiBase(path);

  const { session, refreshSession } = useAuthStore.getState();
  if (session?.accessToken.isExpired()) {
    try {
      await refreshSession();
    } catch {
      // refreshSession handles sign-out on hard auth failure
    }
  }

  // API Lambdas verify Cognito *ID* tokens (custom:role / agencyId live there).
  const next = useAuthStore.getState().session;
  const token = next?.idToken?.trim() || next?.accessToken.jwtToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    // Only clear session on authenticated API 401s — never for public/registry probes.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const path = String(error.config?.url ?? '');
      const hadSession = Boolean(useAuthStore.getState().session?.accessToken.jwtToken);
      const isPublicProbe =
        path.includes('/api/languages') || path.includes('/api/call-intelligence');
      if (hadSession && !isPublicProbe) {
        await useAuthStore.getState().signOut();
      }
    }
    return Promise.reject(error);
  },
);

export { apiClient };

export async function get<T>(
  path: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.get<T>(normalizePath(path), config);
}

export async function post<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.post<T>(normalizePath(path), body, config);
}

export async function patch<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.patch<T>(normalizePath(path), body, config);
}

export async function del<T>(
  path: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.delete<T>(normalizePath(path), config);
}

export async function put<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return apiClient.put<T>(normalizePath(path), body, config);
}

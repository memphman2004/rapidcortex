export type BizCardStatus = {
  enabled: boolean;
  hasProfile: boolean;
  profileStatus?: string;
  activeProfiles?: number;
  totalProfiles?: number;
};

export async function bizCardFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { error?: string; message?: string }) : ({} as T);
  if (!response.ok) {
    const message = (data as { message?: string; error?: string }).message || (data as { error?: string }).error || "Request failed";
    const error = new Error(message) as Error & { status: number; code?: string };
    error.status = response.status;
    error.code = (data as { error?: string }).error;
    throw error;
  }
  return data;
}

export function businessCardSelfHref(pathname: string): string {
  if (pathname.startsWith("/sales")) return "/sales/business-card";
  return "/rc-admin/profile/business-card";
}

export type BizCardStatus = {
  enabled: boolean;
  hasProfile: boolean;
  profileStatus?: string;
  activeProfiles?: number;
  totalProfiles?: number;
};

function parseBizCardBody<T>(text: string, status: number, contentType: string | null): T & { error?: string; message?: string } {
  const trimmed = text.trim();
  if (!trimmed) return {} as T & { error?: string; message?: string };

  try {
    return JSON.parse(trimmed) as T & { error?: string; message?: string };
  } catch {
    const looksHtml =
      trimmed.startsWith("<") ||
      (contentType ?? "").toLowerCase().includes("text/html");
    const error = new Error(
      looksHtml
        ? `Business card API returned HTML instead of JSON (HTTP ${status}). The BFF upstream is likely blocked or misrouted.`
        : `Business card API returned a non-JSON response (HTTP ${status}).`,
    ) as Error & { status: number; code?: string };
    error.status = status;
    error.code = "invalid_json";
    throw error;
  }
}

export async function bizCardFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const data = parseBizCardBody<T>(text, response.status, response.headers.get("content-type"));
  if (!response.ok) {
    const message =
      (data as { message?: string; error?: string }).message ||
      (data as { error?: string }).error ||
      "Request failed";
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

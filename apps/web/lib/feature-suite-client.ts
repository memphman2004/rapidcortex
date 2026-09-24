/**
 * Client helper for the 13-feature suite API (AppSamFeaturesStack).
 * Goes through the cookie BFF → stack-2 upstream `/api/features/*`.
 */

export function featureSuiteUrl(path: string): string {
  const cleaned = path.startsWith("/") ? path.slice(1) : path;
  return `/api/backend/api/features/${cleaned}`;
}

/** Match API `normalizeAddress` then URL-encode for path segments. */
export function featureSuiteAddressKey(
  street: string,
  city: string,
  state: string,
  zip: string,
): string {
  const normalized = `${street.toLowerCase().trim()},${city.toLowerCase().trim()},${state.toLowerCase().trim()},${zip.trim()}`;
  return encodeURIComponent(normalized);
}

export async function featureSuiteFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(featureSuiteUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* keep text */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

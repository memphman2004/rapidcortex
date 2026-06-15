/**
 * Shared client/server base URL resolution for cookie-backed `/api/backend` BFF calls.
 * Browser bundles may omit NEXT_PUBLIC_AUTH_PROXY / NEXT_PUBLIC_API_BASE — same-origin BFF still works.
 */

function normalizeOrigin(raw: string | undefined): string {
  const s = raw?.trim();
  return s ? s.replace(/\/$/, "") : "";
}

export function resolveSameOriginBffBase(directApiBase = ""): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/backend`;
  }

  const useAuthProxy =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PROXY === "1";
  if (useAuthProxy) {
    const site = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
    return site ? `${site}/api/backend` : "http://127.0.0.1:3000/api/backend";
  }

  return normalizeOrigin(directApiBase);
}

export function shouldUseBffCredentials(): boolean {
  if (typeof window !== "undefined") return true;
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PROXY === "1";
}

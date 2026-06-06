/**
 * Shared origin normalization used by CSRF validation and CSP `connect-src`.
 * Keeps apex / `www` pairs in sync so https://site.com vs https://www.site.com behave the same.
 */

export function normalizeHttpOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

/** Loopback / mDNS dev hosts — any port (http://localhost vs :3000 vs :3001). */
export function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/** Same site often answers on both apex and `www`; callers need matching entries for both. */
export function expandCanonicalHttpOrigins(raw: string): string[] {
  let url: URL;
  try {
    const trimmed = raw.trim();
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return [normalizeHttpOrigin(raw)].filter(Boolean);
  }
  const host = url.hostname.toLowerCase();
  const out = new Set<string>([normalizeHttpOrigin(url.origin)]);
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return [...out];
  }
  if (host.startsWith("www.")) {
    const apex = host.slice(4);
    if (apex) {
      try {
        out.add(normalizeHttpOrigin(new URL(`${url.protocol}//${apex}`).origin));
      } catch {
        /* ignore */
      }
    }
  } else {
    try {
      out.add(normalizeHttpOrigin(new URL(`${url.protocol}//www.${host}`).origin));
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

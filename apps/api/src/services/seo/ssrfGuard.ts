import dns from "node:dns/promises";
import net from "node:net";

export class SsrfBlockedError extends Error {
  override readonly name = "SsrfBlockedError";

  constructor(message = "SSRF_BLOCKED") {
    super(message);
  }
}

function isBlockedIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function assertIpLiteralSafe(host: string): void {
  if (!net.isIP(host)) return;
  if (net.isIPv6(host)) {
    const lower = host.toLowerCase();
    if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) {
      throw new SsrfBlockedError();
    }
    return;
  }
  const parts = host.split(".").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) throw new SsrfBlockedError();
  if (isBlockedIpv4(parts)) throw new SsrfBlockedError();
}

/** Blocks SSRF targets including private/link-local IPv4/IPv6 literals before DNS. */
export function assertPublicUrlLiterals(rawUrl: string): URL {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("INVALID_URL");
  }
  if (u.username || u.password) throw new SsrfBlockedError();
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new SsrfBlockedError();
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) throw new SsrfBlockedError();
  if (host === "metadata.google.internal" || host.includes("169.254.169.254")) throw new SsrfBlockedError();
  if (host.endsWith(".internal") || host.endsWith(".local")) throw new SsrfBlockedError();
  assertIpLiteralSafe(host);
  return u;
}

/**
 * DNS rebinding protection: reject hostnames that resolve to private or loopback addresses.
 * Skip when running with SEO_ALLOW_PRIVATE_URL_SCAN=true (non-production diagnostics only).
 */
export async function assertSafeFetchUrl(rawUrl: string): Promise<URL> {
  const u = assertPublicUrlLiterals(rawUrl);
  if (process.env.SEO_ALLOW_PRIVATE_URL_SCAN === "true") {
    return u;
  }
  const host = u.hostname;
  if (net.isIP(host)) {
    return u;
  }
  const records = await dns.lookup(host, { all: true });
  for (const row of records) {
    assertIpLiteralSafe(row.address);
  }
  return u;
}

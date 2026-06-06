import { NETWORK_BYPASS_ROLES } from "./access-policy-types.js";

/** Minimal API Gateway v2 shape for client IP extraction (no aws-lambda dependency). */
export type ClientIpEvent = {
  headers?: Record<string, string | undefined>;
  requestContext?: { http?: { sourceIp?: string } };
};

function isIpv4(ip: string): boolean {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim())) return false;
  return ip
    .trim()
    .split(".")
    .every((oct) => {
      const n = Number.parseInt(oct, 10);
      return n >= 0 && n <= 255;
    });
}

/** Relaxed IPv6 check for masking and coarse CIDR validation (not exhaustive RFC3986 coverage). */
function isIpv6Rough(ip: string): boolean {
  const s = ip.trim();
  return s.includes(":") && s.length >= 2 && s.length <= 128;
}

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

function ipv4ToInt(octets: number[]): number {
  return ((octets[0]! << 24) >>> 0) + (octets[1]! << 16) + (octets[2]! << 8) + octets[3]!;
}

function parseCidrV4(cidr: string): { network: number; mask: number } | null {
  const [ipPart, prefixPart] = cidr.split("/");
  if (!ipPart || prefixPart === undefined) return null;
  const prefix = Number.parseInt(prefixPart, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const octets = parseIpv4(ipPart.trim());
  if (!octets) return null;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = ipv4ToInt(octets) & mask;
  return { network, mask };
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) {
    const v4 = trimmed.slice(7);
    if (isIpv4(v4)) return v4;
  }
  return trimmed;
}

export function isValidCidr(cidr: string): boolean {
  const s = cidr.trim();
  if (!s.includes("/")) return false;
  const [addr] = s.split("/");
  if (!addr) return false;
  if (isIpv4(addr)) return parseCidrV4(s) !== null;
  if (isIpv6Rough(addr)) {
    const prefix = Number.parseInt(s.split("/")[1] ?? "", 10);
    return !Number.isNaN(prefix) && prefix >= 0 && prefix <= 128;
  }
  return false;
}

export function ipMatchesCidrs(ip: string, cidrs: string[]): boolean {
  if (cidrs.length === 0) return false;
  const normalized = normalizeIp(ip);
  if (isIpv4(normalized)) {
    const ipOctets = parseIpv4(normalized);
    if (!ipOctets) return false;
    const ipInt = ipv4ToInt(ipOctets);
    for (const cidr of cidrs) {
      const parsed = parseCidrV4(cidr.trim());
      if (!parsed) continue;
      if ((ipInt & parsed.mask) === parsed.network) return true;
    }
    return false;
  }
  if (isIpv6Rough(normalized)) {
    for (const cidr of cidrs) {
      if (cidr.trim() === normalized) return true;
    }
  }
  return false;
}

export function extractClientIp(event: ClientIpEvent): string {
  const xff =
    event.headers?.["x-forwarded-for"] ??
    event.headers?.["X-Forwarded-For"] ??
    "";
  const first = xff.split(",")[0]?.trim();
  if (first) return normalizeIp(first);
  const source = event.requestContext?.http?.sourceIp?.trim();
  return source ? normalizeIp(source) : "0.0.0.0";
}

export function maskIpForLogging(ip: string): string {
  const n = normalizeIp(ip);
  if (isIpv4(n)) {
    const parts = n.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  if (isIpv6Rough(n)) {
    const segments = n.split(":");
    if (segments.length > 1) {
      segments[segments.length - 1] = "xxx";
      return segments.join(":");
    }
  }
  return "xxx";
}

export function isNetworkExemptRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  return (NETWORK_BYPASS_ROLES as readonly string[]).includes(r);
}

export function isPrivateIp(ip: string): boolean {
  const n = normalizeIp(ip);
  if (!isIpv4(n)) return false;
  const o = parseIpv4(n);
  if (!o) return false;
  const [a, b] = o;
  if (a === 10) return true;
  if (a === 172 && b! >= 16 && b! <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

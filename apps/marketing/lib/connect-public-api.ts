/**
 * Stack-4 public execute-api base for marketing Connect enroll pages
 * (Ring, Nest, Wyze).
 *
 * Canonical env: NEXT_PUBLIC_CONNECT_PUBLIC_BASE
 * Deprecated alias: NEXT_PUBLIC_RING_PUBLIC_OAUTH_BASE (read until marketing env is rotated)
 */
export function connectPublicApiBase(): string {
  const primary = process.env.NEXT_PUBLIC_CONNECT_PUBLIC_BASE?.trim();
  const legacyRing = process.env.NEXT_PUBLIC_RING_PUBLIC_OAUTH_BASE?.trim();
  const legacyCamera = process.env.NEXT_PUBLIC_CAMERA_PUBLIC_API_BASE?.trim();
  return (primary || legacyRing || legacyCamera || "").replace(/\/$/, "");
}

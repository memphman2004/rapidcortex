/**
 * Stack-4 public execute-api base for marketing Connect enroll pages
 * (Nest, Wyze).
 *
 * Canonical env: NEXT_PUBLIC_CONNECT_PUBLIC_BASE
 */
export function connectPublicApiBase(): string {
  const primary = process.env.NEXT_PUBLIC_CONNECT_PUBLIC_BASE?.trim();
  const legacyCamera = process.env.NEXT_PUBLIC_CAMERA_PUBLIC_API_BASE?.trim();
  return (primary || legacyCamera || "").replace(/\/$/, "");
}

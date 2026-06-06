/** Opaque token format used by public media/video/silent-text links. */
const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

export function isLikelyPublicAccessToken(value: string | undefined): value is string {
  if (!value) return false;
  return PUBLIC_TOKEN_PATTERN.test(value.trim());
}

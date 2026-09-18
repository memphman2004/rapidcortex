/** Standard TOTP otpauth URL for Rapid Cortex Google Authenticator enrollment. */
export function buildRapidCortexTotpOtpauthUrl(account: string, secret: string): string {
  const label = `${encodeURIComponent("Rapid Cortex")}:${encodeURIComponent(account)}`;
  const query = [
    `secret=${encodeURIComponent(secret)}`,
    `issuer=${encodeURIComponent("Rapid Cortex")}`,
    "algorithm=SHA1",
    "digits=6",
    "period=30",
  ].join("&");
  return `otpauth://totp/${label}?${query}`;
}

/** Standard TOTP otpauth URL for NexCort iQ Google Authenticator enrollment. */
export function buildRapidCortexTotpOtpauthUrl(account: string, secret: string): string {
  const label = `${encodeURIComponent("NexCort iQ")}:${encodeURIComponent(account)}`;
  const query = [
    `secret=${encodeURIComponent(secret)}`,
    `issuer=${encodeURIComponent("NexCort iQ")}`,
    "algorithm=SHA1",
    "digits=6",
    "period=30",
  ].join("&");
  return `otpauth://totp/${label}?${query}`;
}

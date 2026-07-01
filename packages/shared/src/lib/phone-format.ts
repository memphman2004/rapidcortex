/** Normalize common US/international inputs to E.164 (e.g. "8085428061" → "+18085428061"). */
export function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/** Format E.164 for US display — e.g. "+17065551234" → "(706) 555-1234". */
export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164;
}

/** Vertical-aware label for public QR intake tap-to-call buttons. */
export function qrNfcCallButtonLabel(vertical: string): string {
  const labels: Record<string, string> = {
    campus: "Call Campus Security",
    venue: "Call Venue Security",
    hospital: "Call Security",
    transit: "Call Transit Security",
    "911": "Call Dispatch",
  };
  return labels[vertical] ?? "Call Security";
}

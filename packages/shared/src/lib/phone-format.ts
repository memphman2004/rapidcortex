/** Normalize common US/international inputs to E.164 (e.g. "8085428061" → "+18085428061"). */
export function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/**
 * Converts any common US phone number format to E.164.
 * Returns null when the input cannot be normalized to a valid 10-digit US number.
 */
export function toE164(input: string | null | undefined): string | null {
  if (!input) return null;

  const digits = input.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Returns true when the input resolves to a valid US E.164 number. */
export function isValidUSPhone(input: string): boolean {
  return toE164(input) !== null;
}

/** Applies (NXX) NXX-XXXX mask to raw digit input as the user types. */
export function maskPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);

  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Format E.164 for US display — e.g. "+17065551234" → "(706) 555-1234". */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return "";

  const digits = e164.replace(/\D/g, "");

  const ten =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : null;

  if (!ten) return e164;

  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
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

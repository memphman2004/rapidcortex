/**
 * Validates billing payment instructions before invoice email/PDF send.
 * Accepts both camelCase (data-layer default) and UPPER_SNAKE (ops/docs) keys.
 */

export type NormalizedPaymentInstructions = {
  achRoutingNumber: string;
  achAccountNumber: string;
  bankName: string;
  wireInstructions: string;
  checkMailingAddress: string;
  bankContact: string;
};

function pickString(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = raw[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function isPlaceholder(value: string): boolean {
  return /replace|placeholder|your |todo|xxx|changeme|example/i.test(value);
}

export function normalizePaymentInstructions(secret: unknown): NormalizedPaymentInstructions {
  const s = (secret && typeof secret === "object" ? secret : {}) as Record<string, unknown>;
  const wireFromParts = [
    pickString(s, "WIRE_SWIFT_CODE", "wireSwiftCode"),
    pickString(s, "WIRE_ACCOUNT_NUMBER", "wireAccountNumber"),
  ]
    .filter(Boolean)
    .join(" / ");
  return {
    achRoutingNumber: pickString(s, "ACH_ROUTING_NUMBER", "achRoutingNumber"),
    achAccountNumber: pickString(s, "ACH_ACCOUNT_NUMBER", "achAccountNumber"),
    bankName: pickString(s, "BANK_NAME", "bankName", "achBankName"),
    wireInstructions:
      pickString(s, "WIRE_INSTRUCTIONS", "wireInstructions") || wireFromParts,
    checkMailingAddress: pickString(
      s,
      "CHECK_MAIL_TO",
      "CHECK_MAILING_ADDRESS",
      "checkMailingAddress",
      "checkMailAddress",
    ),
    bankContact: pickString(s, "BANK_CONTACT", "bankContact") || "billing@rapidcortex.us",
  };
}

/**
 * Throw before emailing an invoice if ACH/check instructions are blank or placeholders.
 */
export function validatePaymentInstructionsForSend(
  secret: unknown,
): NormalizedPaymentInstructions {
  const normalized = normalizePaymentInstructions(secret);
  const required: Array<keyof NormalizedPaymentInstructions> = [
    "achRoutingNumber",
    "achAccountNumber",
    "bankName",
    "checkMailingAddress",
  ];
  for (const key of required) {
    const val = normalized[key];
    if (!val || isPlaceholder(val)) {
      throw new Error(
        `[billing] Payment instructions secret is missing or has a placeholder for: ${key}. ` +
          `Populate rapid-cortex/billing/payment-instructions before sending invoices.`,
      );
    }
  }
  if (!/^\d{9}$/.test(normalized.achRoutingNumber)) {
    throw new Error(
      `[billing] ACH routing number is not a valid 9-digit routing number.`,
    );
  }
  return normalized;
}

/** @deprecated Use validatePaymentInstructionsForSend — kept for older imports. */
export function validatePaymentInstructions(secret: unknown): NormalizedPaymentInstructions {
  return validatePaymentInstructionsForSend(secret);
}

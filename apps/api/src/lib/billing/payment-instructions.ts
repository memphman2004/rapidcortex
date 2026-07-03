/**
 * Validates the BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN secret structure.
 * Throw before generating any invoice if this check fails — prevents sending
 * invoices with blank or placeholder payment information.
 */

export interface PaymentInstructionsSecret {
  achRoutingNumber: string;
  achAccountNumber: string;
  achAccountName: string;
  achBankName: string;
  wireSwiftCode: string;
  wireAccountNumber: string;
  wireAccountName: string;
  wireBankName: string;
  checkPayableTo: string;
  checkMailAddress: string;
}

const REQUIRED_KEYS: (keyof PaymentInstructionsSecret)[] = [
  "achRoutingNumber",
  "achAccountNumber",
  "achAccountName",
  "wireSwiftCode",
  "wireAccountNumber",
  "checkPayableTo",
  "checkMailAddress",
];

export function validatePaymentInstructions(secret: unknown): PaymentInstructionsSecret {
  const s = secret as Record<string, unknown>;
  for (const key of REQUIRED_KEYS) {
    const val = s[key];
    if (typeof val !== "string" || val.trim() === "" || val.toUpperCase().includes("PLACEHOLDER")) {
      throw new Error(
        `[billing] BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN is missing or has a placeholder value for: ${key}. ` +
          `Invoices cannot be sent until this is populated in Secrets Manager.`,
      );
    }
  }
  if (!/^\d{9}$/.test((s.achRoutingNumber as string).trim())) {
    throw new Error(
      `[billing] ACH routing number "${s.achRoutingNumber}" is not a valid 9-digit routing number.`,
    );
  }
  return s as unknown as PaymentInstructionsSecret;
}

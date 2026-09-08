import { describe, expect, it } from "vitest";
import { parseAlertRecipientCsv, recipientEligibleForSms } from "./csv.js";
import { isConfirmDispatchToken } from "./schemas.js";

describe("parseAlertRecipientCsv", () => {
  it("rejects phone rows without TCPA consent fields", () => {
    const csv = "email,phone,opt_in_date,opt_in_method,opt_in_consent_text\n,7065551212,,,";
    const parsed = parseAlertRecipientCsv(csv);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]?.message).toMatch(/TCPA/);
  });

  it("accepts a phone row with consent and an email-only row", () => {
    const csv = [
      "email,phone,first_name,groups,opt_in_date,opt_in_method,opt_in_consent_text",
      "a@school.edu,+17065551212,Ann,students,2024-01-15,sis_import,Campus alert opt-in",
      "b@school.edu,,,,,",
    ].join("\n");
    const parsed = parseAlertRecipientCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.smsOptIn).toBe(true);
    expect(parsed.rows[0]?.phoneE164).toBe("+17065551212");
    expect(parsed.rows[1]?.smsOptIn).toBe(false);
    expect(parsed.rows[1]?.email).toBe("b@school.edu");
  });
});

describe("recipientEligibleForSms", () => {
  it("filters opted-out and missing consent at send time", () => {
    expect(
      recipientEligibleForSms({
        phoneE164: "+17065551212",
        smsOptIn: true,
        smsOptedOut: true,
        dnc: false,
      }),
    ).toEqual({ ok: false, reason: "SMS_OPTED_OUT" });
    expect(
      recipientEligibleForSms({
        phoneE164: "+17065551212",
        smsOptIn: false,
        smsOptedOut: false,
        dnc: false,
      }),
    ).toEqual({ ok: false, reason: "NO_SMS_CONSENT" });
  });
});

describe("isConfirmDispatchToken", () => {
  it("accepts case-insensitive CONFIRM only", () => {
    expect(isConfirmDispatchToken("confirm")).toBe(true);
    expect(isConfirmDispatchToken("CONFIRM")).toBe(true);
    expect(isConfirmDispatchToken("yes")).toBe(false);
    expect(isConfirmDispatchToken("")).toBe(false);
  });
});

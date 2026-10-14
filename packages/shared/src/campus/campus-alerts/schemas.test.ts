import { describe, expect, it } from "vitest";
import {
  campusAlertsConfigSchema,
  confirmEmergencyBroadcastBodySchema,
  isCampusAlertsMassSmsClassification,
  previewEmergencyBroadcastBodySchema,
  startCampusAlertsVerifyBodySchema,
  confirmCampusAlertsOtpBodySchema,
} from "./schemas.js";
import { canInitiateCampusAlertsEmergencySms } from "./gates.js";

describe("campus alerts schemas", () => {
  it("defaults tenant config to disabled with no SMS renewal schedule", () => {
    const cfg = campusAlertsConfigSchema.parse({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.registrationValidityDays).toBe(365);
    expect(cfg.reminderDaysBeforeExpiration).toEqual([]);
    expect(cfg.campusWideRenewalCampaignEnabled).toBe(false);
    expect(cfg.remindersEnabled).toBe(false);
    expect(cfg.emergencyMassSmsEnabled).toBe(true);
  });

  it("only allows emergency classifications for mass SMS", () => {
    expect(isCampusAlertsMassSmsClassification("EMERGENCY")).toBe(true);
    expect(isCampusAlertsMassSmsClassification("ALL_CLEAR")).toBe(true);
    expect(isCampusAlertsMassSmsClassification("ANNUAL_RENEWAL")).toBe(false);
    expect(isCampusAlertsMassSmsClassification("ROUTINE")).toBe(false);
    expect(isCampusAlertsMassSmsClassification("SAFETY_ADVISORY")).toBe(false);
    expect(isCampusAlertsMassSmsClassification("TEST")).toBe(false);
  });

  it("requires billing + emergency acknowledgments on confirm", () => {
    const bad = confirmEmergencyBroadcastBodySchema.safeParse({
      previewId: "caprev_abc12345",
      classification: "EMERGENCY",
      messageBody: "Shelter in place",
      expectedRecipientCount: 10,
      expectedEstimatedSegments: 10,
      billingAcknowledgment: false,
      emergencyConfirmation: true,
    });
    expect(bad.success).toBe(false);
    const ok = confirmEmergencyBroadcastBodySchema.safeParse({
      previewId: "caprev_abc12345",
      classification: "EMERGENCY",
      messageBody: "Shelter in place",
      expectedRecipientCount: 10,
      expectedEstimatedSegments: 10,
      billingAcknowledgment: true,
      emergencyConfirmation: true,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects annual renewal as preview classification at schema level still parses but gate blocks", () => {
    const parsed = previewEmergencyBroadcastBodySchema.safeParse({
      classification: "ANNUAL_RENEWAL",
      messageBody: "Please renew",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(isCampusAlertsMassSmsClassification(parsed.data.classification)).toBe(false);
    }
  });

  it("requires explicit SMS consent on OTP start", () => {
    expect(
      startCampusAlertsVerifyBodySchema.safeParse({
        qrId: "qr_1",
        phone: "+15551234567",
        smsConsent: false,
      }).success,
    ).toBe(false);
  });

  it("requires 6-digit OTP", () => {
    expect(
      confirmCampusAlertsOtpBodySchema.safeParse({ challengeId: "chal_abc123", code: "123456" })
        .success,
    ).toBe(true);
  });

  it("limits emergency SMS initiation roles", () => {
    expect(canInitiateCampusAlertsEmergencySms("CAMPUS_ADMIN")).toBe(true);
    expect(canInitiateCampusAlertsEmergencySms("CAMPUS_DISPATCH")).toBe(true);
    expect(canInitiateCampusAlertsEmergencySms("CAMPUS_SECURITY")).toBe(false);
    expect(canInitiateCampusAlertsEmergencySms("dispatcher")).toBe(false);
    expect(canInitiateCampusAlertsEmergencySms("VENUE_ADMIN")).toBe(false);
  });
});

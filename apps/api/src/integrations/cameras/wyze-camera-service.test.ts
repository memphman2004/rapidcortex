import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/env.js", () => ({
  env: {
    region: "us-east-1",
    wyzeKmsKeyArn: "arn:aws:kms:us-east-1:1:key/test",
    wyzeRegistrationsTableName: "wyze-reg",
    wyzeConsentTableName: "wyze-consent",
    connectPublicApiBaseUrl: "https://api.example.com",
    auditTable: "audit",
  },
}));

vi.mock("../../repositories/baseRepository.js", () => ({
  ddb: { send: vi.fn() },
}));

vi.mock("../../lib/silentTextSms.js", () => ({
  sendSilentTextSms: vi.fn(),
}));

vi.mock("@aws-sdk/client-kms", () => ({
  KMSClient: class {
    send = vi.fn();
  },
  DecryptCommand: class {},
  GenerateDataKeyCommand: class {},
}));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = vi.fn();
  },
  GetSecretValueCommand: class {},
}));

import {
  isApprovedUnexpiredWyzeConsent,
  wyzeCameraDistanceMeters,
} from "./wyze-camera-service.js";
import type { WyzeConsentRequest } from "./wyze-tables.js";

describe("wyzeCameraDistanceMeters", () => {
  it("returns ~0 for the same point and a large distance for a far point", () => {
    const near = wyzeCameraDistanceMeters({ latitude: 39.1, longitude: -94.58 }, 39.1, -94.58);
    const far = wyzeCameraDistanceMeters({ latitude: 38.0, longitude: -90.0 }, 39.1, -94.58);
    expect(near).toBeLessThan(5);
    expect(far).toBeGreaterThan(500);
  });
});

describe("isApprovedUnexpiredWyzeConsent", () => {
  const base: WyzeConsentRequest = {
    requestPk: "ag-1#inc-1#MAC",
    requestId: "r1",
    tokenHash: "hash",
    ownerId: "o1",
    agencyId: "ag-1",
    incidentId: "inc-1",
    mac: "MAC",
    deviceName: "Cam",
    requestStatus: "APPROVED",
    requestedDurationMinutes: 30,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  it("allows only APPROVED unexpired consent for the same agency", () => {
    expect(isApprovedUnexpiredWyzeConsent(base, "ag-1")).toBe(true);
    expect(isApprovedUnexpiredWyzeConsent({ ...base, requestStatus: "SENT" }, "ag-1")).toBe(false);
    expect(isApprovedUnexpiredWyzeConsent(base, "other-agency")).toBe(false);
    expect(
      isApprovedUnexpiredWyzeConsent(
        { ...base, expiresAt: new Date(Date.now() - 1_000).toISOString() },
        "ag-1",
      ),
    ).toBe(false);
    expect(isApprovedUnexpiredWyzeConsent(null, "ag-1")).toBe(false);
  });
});

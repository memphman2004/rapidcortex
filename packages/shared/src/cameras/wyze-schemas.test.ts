import { describe, expect, it } from "vitest";
import { wyzeAnswerStreamBodySchema, wyzeRegisterBodySchema, wyzeRequestCameraAccessBodySchema } from "./wyze-schemas.js";

const validRegister = {
  agencyId: "agency-1",
  email: "owner@example.com",
  phone: "+15551234567",
  keyId: "key-id",
  apiKey: "api-key-secret",
  address: "123 Main Street",
  lat: 39.1,
  lng: -94.5,
};

describe("wyzeRegisterBodySchema", () => {
  it("accepts a complete E.164 US registration", () => {
    expect(wyzeRegisterBodySchema.parse(validRegister)).toEqual(validRegister);
  });

  it("rejects a missing agencyId and non-E.164 phone", () => {
    expect(wyzeRegisterBodySchema.safeParse({ ...validRegister, agencyId: "" }).success).toBe(false);
    expect(wyzeRegisterBodySchema.safeParse({ ...validRegister, phone: "5551234567" }).success).toBe(
      false,
    );
  });
});

describe("wyzeRequestCameraAccessBodySchema", () => {
  it("accepts allowed durations only", () => {
    expect(
      wyzeRequestCameraAccessBodySchema.parse({
        incidentId: "inc-1",
        mac: "AA:BB:CC:DD:EE:FF",
        requestedDurationMinutes: 30,
      }),
    ).toMatchObject({ requestedDurationMinutes: 30 });
    expect(
      wyzeRequestCameraAccessBodySchema.safeParse({
        incidentId: "inc-1",
        mac: "AA:BB:CC:DD:EE:FF",
        requestedDurationMinutes: 15,
      }).success,
    ).toBe(false);
  });
});

describe("wyzeAnswerStreamBodySchema", () => {
  it("requires incidentId and mac", () => {
    expect(
      wyzeAnswerStreamBodySchema.parse({ incidentId: "inc-1", mac: "AA:BB:CC:DD:EE:FF" }),
    ).toEqual({ incidentId: "inc-1", mac: "AA:BB:CC:DD:EE:FF" });
    expect(wyzeAnswerStreamBodySchema.safeParse({ mac: "AA:BB:CC:DD:EE:FF" }).success).toBe(false);
  });
});

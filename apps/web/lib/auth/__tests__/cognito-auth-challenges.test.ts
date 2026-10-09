import { describe, expect, it } from "vitest";
import { mfaOptionsFromCognitoList } from "@/components/auth/mfa-method-picker";
import { mapCognitoChallenge, selectMfaAnswer } from "@/lib/auth/cognito-auth-challenges";

describe("cognito-auth-challenges", () => {
  it("maps SELECT_MFA_TYPE with MFAS_CAN_SELECT JSON", () => {
    const mapped = mapCognitoChallenge(
      "SELECT_MFA_TYPE",
      "sess",
      "user@agency.gov",
      { MFAS_CAN_SELECT: '["EMAIL_OTP","SOFTWARE_TOKEN_MFA"]' },
    );
    expect(mapped?.challenge).toBe("SELECT_MFA_TYPE");
    expect(mapped?.mfasCanSelect).toEqual(["EMAIL_OTP", "SOFTWARE_TOKEN_MFA"]);
  });

  it("maps MFA_SETUP with MFAS_CAN_SETUP", () => {
    const mapped = mapCognitoChallenge("MFA_SETUP", "sess", "user@agency.gov", {
      MFAS_CAN_SETUP: "SOFTWARE_TOKEN_MFA,EMAIL_OTP",
    });
    expect(mapped?.mfasCanSetup).toEqual(["SOFTWARE_TOKEN_MFA", "EMAIL_OTP"]);
  });

  it("normalizes SELECT_MFA_TYPE answers", () => {
    expect(selectMfaAnswer("email")).toBe("EMAIL_MFA");
    expect(selectMfaAnswer("EMAIL_OTP")).toBe("EMAIL_MFA");
    expect(selectMfaAnswer("authenticator")).toBe("SOFTWARE_TOKEN_MFA");
    expect(selectMfaAnswer("SOFTWARE_TOKEN_MFA")).toBe("SOFTWARE_TOKEN_MFA");
  });
});

describe("mfaOptionsFromCognitoList", () => {
  it("defaults to email + authenticator", () => {
    expect(mfaOptionsFromCognitoList(undefined)).toEqual(["email", "authenticator"]);
  });

  it("filters to cognito-offered factors", () => {
    expect(mfaOptionsFromCognitoList(["EMAIL_OTP", "SOFTWARE_TOKEN_MFA"])).toEqual([
      "email",
      "authenticator",
    ]);
  });
});

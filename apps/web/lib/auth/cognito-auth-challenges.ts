import type { RespondToAuthChallengeCommandOutput } from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";
import { applyCognitoAuthCookies } from "@/lib/auth/apply-auth-cookies";

/** Cognito challenges the custom login UI understands. */
export type CognitoAuthChallenge =
  | "EMAIL_OTP"
  | "EMAIL_MFA"
  | "NEW_PASSWORD_REQUIRED"
  | "MFA_SETUP"
  | "SOFTWARE_TOKEN_MFA"
  | "SMS_MFA"
  | "SELECT_MFA_TYPE";

export type CognitoChallengePayload = {
  challenge: CognitoAuthChallenge;
  session: string;
  username: string;
  /** Parsed from `MFAS_CAN_SELECT` when challenge is SELECT_MFA_TYPE. */
  mfasCanSelect?: string[];
  /** Parsed from `MFAS_CAN_SETUP` when challenge is MFA_SETUP. */
  mfasCanSetup?: string[];
};

function parseMfaList(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // Cognito sometimes returns a comma-separated string
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveChallengeUsername(
  usernameInput: string,
  out: { ChallengeParameters?: Record<string, string> | undefined },
): string {
  return (
    out.ChallengeParameters?.USER_ID_FOR_SRP ??
    out.ChallengeParameters?.USERNAME ??
    usernameInput
  );
}

export function mapCognitoChallenge(
  challengeName: string | undefined,
  session: string | undefined,
  usernameInput: string,
  challengeParameters?: Record<string, string>,
): CognitoChallengePayload | null {
  if (!challengeName || !session) return null;
  const username = resolveChallengeUsername(usernameInput, {
    ChallengeParameters: challengeParameters,
  });

  switch (challengeName) {
    case "EMAIL_OTP":
    case "EMAIL_MFA":
    case "NEW_PASSWORD_REQUIRED":
    case "SOFTWARE_TOKEN_MFA":
    case "SMS_MFA":
    case "SELECT_MFA_TYPE":
    case "MFA_SETUP": {
      const payload: CognitoChallengePayload = {
        challenge: challengeName,
        session,
        username,
      };
      if (challengeName === "SELECT_MFA_TYPE") {
        payload.mfasCanSelect = parseMfaList(challengeParameters?.MFAS_CAN_SELECT);
      }
      if (challengeName === "MFA_SETUP") {
        payload.mfasCanSetup = parseMfaList(challengeParameters?.MFAS_CAN_SETUP);
      }
      return payload;
    }
    default:
      return null;
  }
}

/** 202 challenge JSON, or cookies on success, or null if unsupported. */
export function nextResponseForAuthResult(
  out: RespondToAuthChallengeCommandOutput,
  usernameInput: string,
): NextResponse | null {
  const auth = out.AuthenticationResult;
  const idToken = auth?.IdToken;
  const accessToken = auth?.AccessToken;
  if (idToken && accessToken) {
    const res = NextResponse.json({ ok: true });
    applyCognitoAuthCookies(res, {
      IdToken: idToken,
      AccessToken: accessToken,
      RefreshToken: auth.RefreshToken,
      ExpiresIn: auth.ExpiresIn,
    });
    return res;
  }

  const mapped = mapCognitoChallenge(
    out.ChallengeName,
    out.Session ?? undefined,
    usernameInput,
    out.ChallengeParameters,
  );
  if (!mapped) return null;
  return NextResponse.json(mapped, { status: 202 });
}

/** Map SELECT_MFA_TYPE UI choice → Cognito ANSWER value. */
export function selectMfaAnswer(choice: string): string | null {
  const c = choice.trim().toUpperCase();
  if (c === "EMAIL_OTP" || c === "EMAIL_MFA" || c === "EMAIL") return "EMAIL_MFA";
  if (
    c === "SOFTWARE_TOKEN_MFA" ||
    c === "SOFTWARE_TOKEN" ||
    c === "TOTP" ||
    c === "AUTHENTICATOR"
  ) {
    return "SOFTWARE_TOKEN_MFA";
  }
  if (c === "SMS_MFA" || c === "SMS") return "SMS_MFA";
  return null;
}

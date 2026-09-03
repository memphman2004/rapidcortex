import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const {
  authenticateHomeowner,
  matchNonce,
  validateConsentToken,
  isDisposableEmail,
  isRingEnabled,
  consumeRingPublicOAuthRateSlot,
} = vi.hoisted(() => ({
  authenticateHomeowner: vi.fn(),
  matchNonce: vi.fn(),
  validateConsentToken: vi.fn(),
  isDisposableEmail: vi.fn(() => false),
  isRingEnabled: vi.fn(() => true),
  consumeRingPublicOAuthRateSlot: vi.fn(async () => true),
}));

vi.mock("../../lib/env.js", () => ({
  env: {
    region: "us-east-1",
    cognitoUserPoolId: "us-east-1_test",
    ringRequestsTable: "RingEmergencyCameraRequests-test",
    ringUnclaimedTokensTable: "unclaimed-test",
    ringAccountsTable: "accounts-test",
    ringDevicesTable: "devices-test",
    ringCitizenOwnersTable: "owners-test",
    ringHomeownerParticipantsTable: "participants-test",
    auditTable: "audit-test",
  },
}));

vi.mock("../../lib/ring-integration.js", () => ({
  isRingEnabled: () => isRingEnabled(),
  RING_HOMEOWNER_DEFAULT_AGENCY_ID: "test-agency",
  RING_HOMEOWNER_FALLBACK_LATITUDE: 1,
  RING_HOMEOWNER_FALLBACK_LONGITUDE: 2,
  RING_ACCOUNT_LINK_URL: "https://www.rapidcortex.us/connect/ring/link",
  validateRingLinkTimestamp: () => ({ ok: true }),
  maskEmailForRing: (e: string) => e,
  postRingAppIntegration: vi.fn(),
  patchRingAppIntegrationCompleted: vi.fn(),
  RingUnclaimedTokenService: class {
    matchNonce = matchNonce;
  },
  RingTokenStore: class {
    storeTokens = vi.fn();
    storeCitizenTokens = vi.fn();
    deleteTokens = vi.fn();
  },
  RingDeviceService: class {
    discoverAndSaveDevices = vi.fn(async () => []);
  },
  RingApiClient: class {
    getPartnerUserProfile = vi.fn(async () => ({ accountId: "acct-1" }));
  },
}));

vi.mock("./homeowner-cognito.js", () => ({
  authenticateHomeowner: (...args: unknown[]) => authenticateHomeowner(...args),
}));

vi.mock("./homeowner-signup-guards.js", () => ({
  isDisposableEmail: (...args: unknown[]) => isDisposableEmail(...args),
  validateConsentToken: (...args: unknown[]) => validateConsentToken(...args),
}));

vi.mock("./ring-consent-rate-limit.js", () => ({
  consumeRingPublicOAuthRateSlot: (...args: unknown[]) => consumeRingPublicOAuthRateSlot(...args),
}));

vi.mock("./ring-audit.js", () => ({
  auditRingEvent: vi.fn(),
  AUDIT_EVENT_TYPES: {
    RING_HOMEOWNER_SIGNED_UP: "ring.homeowner.signed_up",
    RING_HOMEOWNER_SIGNED_IN: "ring.homeowner.signed_in",
    RING_APPSTORE_ACCOUNT_LINKED: "ring.appstore.account.linked",
  },
}));

vi.mock("./ring-tables.js", () => ({
  configureRingEmergencyTables: vi.fn(),
}));

vi.mock("../../repositories/ringAccountRepository.js", () => ({
  RingAccountRepository: class {
    getLinkedAccount = vi.fn(async () => null);
    upsertLinkedAccount = vi.fn();
  },
}));

vi.mock("../../repositories/ringCitizenOwnerRepository.js", () => ({
  ringCitizenOwnerPk: (id: string) => `RINGOWNER#${id}`,
  RingCitizenOwnerRepository: class {
    getByRingAccountId = vi.fn(async () => null);
    upsert = vi.fn();
  },
}));

vi.mock("../../repositories/ringHomeownerParticipantRepository.js", () => ({
  RingHomeownerParticipantRepository: class {
    getByHomeownerId = vi.fn(async () => null);
    upsert = vi.fn();
  },
}));

function postEvent(body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /api/public/ring/homeowner/link",
    rawPath: "/api/public/ring/homeowner/link",
    rawQueryString: "",
    headers: { origin: "https://www.rapidcortex.us" },
    requestContext: { http: { method: "POST", sourceIp: "1.1.1.1" } },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe("homeowner-link signup gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRingEnabled.mockReturnValue(true);
    consumeRingPublicOAuthRateSlot.mockResolvedValue(true);
    isDisposableEmail.mockReturnValue(false);
    validateConsentToken.mockResolvedValue(false);
    matchNonce.mockResolvedValue(null);
  });

  it("returns 403 when signup has no valid consent token and no matching Appstore nonce", async () => {
    const { handler } = await import("./homeowner-link.js");
    const res = await handler(
      postEvent({
        email: "owner@example.com",
        password: "RapidCore2027!",
        mode: "signup",
        nonce: "n".repeat(16),
        time: String(Date.now()),
      }),
    );
    expect(res).toMatchObject({ statusCode: 403 });
    expect(JSON.parse(String((res as { body: string }).body))).toEqual({ error: "Forbidden" });
    expect(authenticateHomeowner).not.toHaveBeenCalled();
  });

  it("returns 400 for disposable email without creating an account", async () => {
    isDisposableEmail.mockReturnValue(true);
    const { handler } = await import("./homeowner-link.js");
    const res = await handler(
      postEvent({
        email: "a@mailinator.com",
        password: "RapidCore2027!",
        mode: "signup",
        nonce: "n".repeat(16),
        time: String(Date.now()),
      }),
    );
    expect(res).toMatchObject({ statusCode: 400 });
    expect(JSON.parse(String((res as { body: string }).body))).toEqual({
      error: "Invalid email address.",
    });
    expect(authenticateHomeowner).not.toHaveBeenCalled();
  });

  it("allows Appstore signup when a live unclaimed nonce matches", async () => {
    matchNonce.mockResolvedValue({
      record: { accountId: "acct-1" },
      tokens: { accessToken: "at", scope: "" },
    });
    authenticateHomeowner.mockRejectedValue(new Error("AUTH_FAILED"));
    const { handler } = await import("./homeowner-link.js");
    const res = await handler(
      postEvent({
        email: "owner@example.com",
        password: "RapidCore2027!",
        mode: "signup",
        nonce: "n".repeat(16),
        time: String(Date.now()),
      }),
    );
    expect(res).toMatchObject({ statusCode: 401 });
    expect(authenticateHomeowner).toHaveBeenCalledOnce();
  });

  it("allows dispatcher-consent signup when the consent token is valid", async () => {
    validateConsentToken.mockResolvedValue(true);
    authenticateHomeowner.mockRejectedValue(new Error("AUTH_FAILED"));
    const { handler } = await import("./homeowner-link.js");
    const res = await handler(
      postEvent({
        email: "owner@example.com",
        password: "RapidCore2027!",
        mode: "signup",
        nonce: "n".repeat(16),
        time: String(Date.now()),
        consentToken: "c".repeat(24),
      }),
    );
    expect(res).toMatchObject({ statusCode: 401 });
    expect(authenticateHomeowner).toHaveBeenCalledOnce();
  });

  it("does not require a consent token for sign-in", async () => {
    authenticateHomeowner.mockRejectedValue(new Error("AUTH_FAILED"));
    const { handler } = await import("./homeowner-link.js");
    const res = await handler(
      postEvent({
        email: "owner@example.com",
        password: "RapidCore2027!",
        mode: "signin",
        nonce: "n".repeat(16),
        time: String(Date.now()),
      }),
    );
    expect(res).toMatchObject({ statusCode: 401 });
    expect(authenticateHomeowner).toHaveBeenCalledOnce();
  });
});

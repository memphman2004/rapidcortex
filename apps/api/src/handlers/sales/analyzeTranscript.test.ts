import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/auth.js", () => ({
  getUserContext: vi.fn(),
  isUserAccountActive: vi.fn(() => true),
  ACCOUNT_INACTIVE_MESSAGE: "inactive",
}));
vi.mock("../../lib/operationalPasswordGate.js", () => ({
  operationalPasswordBlock: vi.fn(() => null),
}));
vi.mock("../../lib/env.js", () => ({
  env: { enableSalesTools: true },
}));
vi.mock("../../lib/sales/call-coach-analyze.js", () => ({
  analyzeSalesCallTranscript: vi.fn(),
}));
vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn(async () => undefined);
  },
}));
vi.mock("../../lib/correlation.js", () => ({
  withCorrelationHeaders: (_e: unknown, r: unknown) => r,
}));

import { getUserContext } from "../../lib/auth.js";
import { analyzeSalesCallTranscript } from "../../lib/sales/call-coach-analyze.js";
import { salesCallCoachMockFixture } from "rapid-cortex-shared";
import { handler } from "./analyzeTranscript.js";

function eventWithBody(body: unknown, role = "salescontractor") {
  (getUserContext as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: "u1",
    role,
    email: "rep@example.com",
    agencyId: "__platform__",
  });
  return {
    body: JSON.stringify(body),
    requestContext: { http: { method: "POST", path: "/api/sales/analyze-transcript" } },
  } as never;
}

describe("analyzeTranscript handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (analyzeSalesCallTranscript as ReturnType<typeof vi.fn>).mockResolvedValue(
      salesCallCoachMockFixture(),
    );
  });

  it("returns 403 for dispatcher", async () => {
    const res = await handler(
      eventWithBody({ transcript: "x".repeat(60) }, "dispatcher"),
      {} as never,
      (() => undefined) as never,
    );
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(403);
  });

  it("returns mock coaching for salescontractor", async () => {
    const res = await handler(
      eventWithBody({ transcript: "x".repeat(60), vertical: "campus" }),
      {} as never,
      (() => undefined) as never,
    );
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(200);
    const body = JSON.parse((res as { body: string }).body) as {
      categories?: unknown[];
    };
    expect(body.categories?.length).toBe(6);
    expect(analyzeSalesCallTranscript).toHaveBeenCalled();
  });

  it("returns 400 for short transcript", async () => {
    const res = await handler(
      eventWithBody({ transcript: "short" }),
      {} as never,
      (() => undefined) as never,
    );
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(400);
  });
});

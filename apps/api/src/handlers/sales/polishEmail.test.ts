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
vi.mock("../../lib/sales/email-polish.js", () => ({
  polishSalesEmail: vi.fn(),
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
import { polishSalesEmail } from "../../lib/sales/email-polish.js";
import { salesEmailPolishMockFixture } from "rapid-cortex-shared";
import { handler } from "./polishEmail.js";

function eventWithBody(body: unknown, role = "salescontractor") {
  (getUserContext as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: "u1",
    role,
    email: "rep@example.com",
    agencyId: "__platform__",
  });
  return {
    body: JSON.stringify(body),
    requestContext: { http: { method: "POST", path: "/api/sales/polish-email" } },
  } as never;
}

describe("polishEmail handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (polishSalesEmail as ReturnType<typeof vi.fn>).mockImplementation(async (input) =>
      salesEmailPolishMockFixture(input),
    );
  });

  it("returns 403 for dispatcher", async () => {
    const res = await handler(
      eventWithBody(
        { body: "Hello, this is a longer sales email draft for polish." },
        "dispatcher",
      ),
      {} as never,
      (() => undefined) as never,
    );
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(403);
  });

  it("returns polished email for salescontractor", async () => {
    const res = await handler(
      eventWithBody({
        subject: "hi",
        body: "Hello, this is a longer sales email draft for polish testing.",
      }),
      {} as never,
      (() => undefined) as never,
    );
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(200);
    const body = JSON.parse((res as { body: string }).body) as { body?: string; mock?: boolean };
    expect(body.body?.length).toBeGreaterThan(0);
    expect(polishSalesEmail).toHaveBeenCalled();
  });
});

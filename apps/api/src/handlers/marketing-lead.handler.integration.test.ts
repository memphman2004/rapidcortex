import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  buildMarketingLeadRequestBody,
  resolveMarketingLeadSource,
} from "rapid-cortex-shared";
import { invokeHttpHandler, makeUnauthenticatedEvent } from "./handlerTestUtils.js";

const { mockDdbSend, mockSesSend } = vi.hoisted(() => ({
  mockDdbSend: vi.fn(),
  mockSesSend: vi.fn(),
}));

vi.mock("../repositories/baseRepository.js", () => ({
  ddb: { send: mockDdbSend },
}));

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: class {
    send = mockSesSend;
  },
  SendEmailCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("../lib/env.js", () => ({
  env: {
    enableInsideTheCortex: true,
    marketingLeadsTable: "rapid-cortex-marketing-leads-test",
    sesFromEmail: "noreply@rapidcortex.us",
    contactFromEmail: "",
    rcTeamNotifyEmail: "team@rapidcortex.us",
    sesMock: true,
  },
}));

import { handler } from "./marketing-lead.js";

const FULL_LEAD_FIELDS = [
  "pk",
  "sk",
  "leadId",
  "unsubscribeToken",
  "firstName",
  "lastName",
  "email",
  "state",
  "source",
  "referrer",
  "landingPage",
  "capturedAt",
  "createdAt",
  "status",
  "ttl",
] as const;

describe("marketing-lead E2E contract", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
    mockSesSend.mockReset();
  });

  it("frontend builder payload includes every capture field the Lambda persists", () => {
    const built = buildMarketingLeadRequestBody(
      {
        firstName: " Jane ",
        lastName: " Smith ",
        email: "Jane.Smith@Agency.GOV",
        state: " Louisiana ",
      },
      {
        referrer: "https://www.google.com/search?q=rapid+cortex",
        landingPage: "/pricing/?utm_source=google&utm_campaign=spring",
        capturedAt: "2026-07-20T19:00:00.000Z",
      },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.body).toEqual({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@agency.gov",
      state: "Louisiana",
      referrer: "https://www.google.com/search?q=rapid+cortex",
      landingPage: "/pricing/?utm_source=google&utm_campaign=spring",
      capturedAt: "2026-07-20T19:00:00.000Z",
    });
    expect(resolveMarketingLeadSource(built.body.referrer)).toBe("google");
  });

  it("writes lead + unsubscribe token with full profile fields", async () => {
    mockDdbSend
      .mockResolvedValueOnce({ Item: undefined }) // dedup Get
      .mockResolvedValueOnce({}) // lead Put
      .mockResolvedValueOnce({}); // token Put

    const built = buildMarketingLeadRequestBody(
      {
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@psap.example",
        state: "Georgia",
      },
      {
        referrer: "https://www.linkedin.com/in/someone",
        landingPage: "/demo/?utm_medium=social",
        capturedAt: "2026-07-20T19:05:00.000Z",
      },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const res = await invokeHttpHandler(
      handler,
      makeUnauthenticatedEvent({
        routeKey: "POST /api/marketing/lead",
        rawPath: "/api/marketing/lead",
        body: JSON.stringify(built.body),
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as { success?: boolean; leadId?: string };
    expect(body.success).toBe(true);
    expect(body.leadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(mockDdbSend).toHaveBeenCalledTimes(3);
    expect(mockDdbSend.mock.calls[0]?.[0]).toBeInstanceOf(GetCommand);
    expect(mockDdbSend.mock.calls[1]?.[0]).toBeInstanceOf(PutCommand);
    expect(mockDdbSend.mock.calls[2]?.[0]).toBeInstanceOf(PutCommand);

    const leadPut = mockDdbSend.mock.calls[1]?.[0] as PutCommand;
    const leadItem = (leadPut.input as { Item: Record<string, unknown> }).Item;
    for (const key of FULL_LEAD_FIELDS) {
      expect(leadItem).toHaveProperty(key);
    }
    expect(leadItem.pk).toBe("LEAD#alex@psap.example");
    expect(leadItem.sk).toBe("PROFILE");
    expect(leadItem.firstName).toBe("Alex");
    expect(leadItem.lastName).toBe("Rivera");
    expect(leadItem.email).toBe("alex@psap.example");
    expect(leadItem.state).toBe("Georgia");
    expect(leadItem.source).toBe("linkedin");
    expect(leadItem.referrer).toBe("https://www.linkedin.com/in/someone");
    expect(leadItem.landingPage).toBe("/demo/?utm_medium=social");
    expect(leadItem.capturedAt).toBe("2026-07-20T19:05:00.000Z");
    expect(leadItem.status).toBe("active");
    expect(typeof leadItem.ttl).toBe("number");

    const tokenPut = mockDdbSend.mock.calls[2]?.[0] as PutCommand;
    const tokenItem = (tokenPut.input as { Item: Record<string, unknown> }).Item;
    expect(tokenItem.pk).toBe(`TOKEN#${leadItem.unsubscribeToken}`);
    expect(tokenItem.sk).toBe("UNSUBSCRIBE");
    expect(tokenItem.email).toBe("alex@psap.example");
    expect(tokenItem.leadId).toBe(leadItem.leadId);
  });

  it("rejects personal inbox domains (aligned with popup)", async () => {
    const built = buildMarketingLeadRequestBody({
      firstName: "A",
      lastName: "B",
      email: "person@gmail.com",
      state: "TX",
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.fieldErrors.email).toMatch(/business email/i);

    const res = await invokeHttpHandler(
      handler,
      makeUnauthenticatedEvent({
        routeKey: "POST /api/marketing/lead",
        rawPath: "/api/marketing/lead",
        body: JSON.stringify({
          firstName: "A",
          lastName: "B",
          email: "person@gmail.com",
          state: "TX",
        }),
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(mockDdbSend).not.toHaveBeenCalled();
  });

  it("returns success silently for duplicates", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Item: { pk: "LEAD#dup@agency.gov", sk: "PROFILE" },
    });

    const res = await invokeHttpHandler(
      handler,
      makeUnauthenticatedEvent({
        routeKey: "POST /api/marketing/lead",
        rawPath: "/api/marketing/lead",
        body: JSON.stringify({
          firstName: "Dup",
          lastName: "User",
          email: "dup@agency.gov",
          state: "OH",
        }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toEqual({ success: true, duplicate: true });
    expect(mockDdbSend).toHaveBeenCalledTimes(1);
  });
});

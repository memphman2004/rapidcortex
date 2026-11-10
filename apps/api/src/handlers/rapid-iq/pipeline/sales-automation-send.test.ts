import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RapidIqSalesSequence } from "rapid-cortex-shared";

const listSalesSequences = vi.fn(async () => [] as RapidIqSalesSequence[]);
const getOutlookConnection = vi.fn(async () => null);
const putOutlookConnection = vi.fn(async () => undefined);
const putSalesSequence = vi.fn(async () => undefined);
const recordSalesSend = vi.fn(async () => undefined);
const incrementSalesCampaignStat = vi.fn(async () => undefined);
const checkSuppression = vi.fn(async () => ({ suppressed: false as const }));
const applyUnsubscribeTokenToEmailBodies = vi.fn(
  (bodies: { text: string; html?: string }) => bodies,
);
const sendOutlookMail = vi.fn(async () => undefined);
const ensureOutlookAccessToken = vi.fn(async () => ({ accessToken: "tok", next: null }));
const isOutlookGraphMock = vi.fn(() => false);
const sesSend = vi.fn(async () => undefined);

vi.mock("../../../lib/rapid-iq/sales-automation-db.js", () => ({
  listSalesSequences: (...args: unknown[]) => listSalesSequences(...args),
  getOutlookConnection: (...args: unknown[]) => getOutlookConnection(...args),
  putOutlookConnection: (...args: unknown[]) => putOutlookConnection(...args),
  putSalesSequence: (...args: unknown[]) => putSalesSequence(...args),
  recordSalesSend: (...args: unknown[]) => recordSalesSend(...args),
  incrementSalesCampaignStat: (...args: unknown[]) => incrementSalesCampaignStat(...args),
  getSalesSequence: vi.fn(async () => null),
}));

vi.mock("../../../lib/rapid-iq/sales-automation-engine.js", () => ({
  checkSuppression: (...args: unknown[]) => checkSuppression(...args),
  applyUnsubscribeTokenToEmailBodies: (...args: unknown[]) =>
    applyUnsubscribeTokenToEmailBodies(...(args as [ { text: string; html?: string } ])),
}));

vi.mock("../../../lib/rapid-iq/outlook-graph.js", () => ({
  sendOutlookMail: (...args: unknown[]) => sendOutlookMail(...args),
  ensureOutlookAccessToken: (...args: unknown[]) => ensureOutlookAccessToken(...args),
  isOutlookGraphMock: (...args: unknown[]) => isOutlookGraphMock(...args),
}));

vi.mock("../../../lib/ses/sesMarketingConfigurationSet.js", () => ({
  sesMarketingConfigurationSetFields: () => ({ ConfigurationSetName: "nexcortiq-marketing" }),
}));

vi.mock("../../../lib/env.js", () => ({
  env: {
    get sesMock() {
      return process.env.SES_MOCK === "true" || process.env.SES_MOCK === "1";
    },
    sesFromEmail: "jeff@nexcortiq.us",
    outlookSalesMailbox: "jeff@nexcortiq.us",
    marketingLeadsTable: "",
  },
}));

vi.mock("../../../repositories/baseRepository.js", () => ({
  ddb: { send: vi.fn() },
}));

vi.mock("../../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    async create() {
      return undefined;
    }
  },
}));

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: class {
    send = (...args: unknown[]) => sesSend(...args);
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { handler, prefersSesTracking } from "./sales-automation-send.js";

function dueSequence(
  triggerType: RapidIqSalesSequence["triggerType"] = "campaign",
): RapidIqSalesSequence {
  return {
    sequenceId: "seq_1",
    triggerId: "campaign",
    triggerType,
    vertical: "PSAP",
    recipientEmail: "director@example.gov",
    recipientName: "Maria",
    agencyName: "Example PSAP",
    status: "active",
    autoApprove: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        stepId: "step_1",
        stepNumber: 1,
        label: "initial",
        delayDays: 0,
        scheduledAt: new Date(Date.now() - 1000).toISOString(),
        status: "scheduled",
        email: { subject: "Walkthrough", bodyText: "Hi Maria" },
      },
    ],
    attribution: { campaignId: "bulk_psap_1", campaignName: "PSAP outreach" },
  };
}

function connectedOutlook() {
  return {
    agencyId: "platform",
    mailbox: "jeff@nexcortiq.us",
    mock: false,
    refreshTokenEnc: "enc",
    connectedBy: "u-admin",
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("sales automation campaign send", () => {
  beforeEach(() => {
    listSalesSequences.mockReset().mockResolvedValue([]);
    getOutlookConnection.mockReset().mockResolvedValue(null);
    putOutlookConnection.mockReset();
    putSalesSequence.mockReset();
    recordSalesSend.mockReset();
    incrementSalesCampaignStat.mockReset();
    checkSuppression.mockReset().mockResolvedValue({ suppressed: false });
    applyUnsubscribeTokenToEmailBodies.mockClear();
    sendOutlookMail.mockReset();
    ensureOutlookAccessToken.mockReset().mockResolvedValue({ accessToken: "tok", next: null });
    isOutlookGraphMock.mockReset().mockReturnValue(false);
    sesSend.mockReset();
    process.env.ENABLE_SALES_AUTOMATION = "true";
    delete process.env.SES_MOCK;
    process.env.SES_FROM_EMAIL = "jeff@nexcortiq.us";
  });

  it("marks newsletter and campaign sequences for SES tracking", () => {
    expect(prefersSesTracking(dueSequence("newsletter"))).toBe(true);
    expect(prefersSesTracking(dueSequence("campaign"))).toBe(true);
    expect(prefersSesTracking(dueSequence("rfp_signal"))).toBe(false);
  });

  it("sends bulk campaign steps via SES even when Outlook is connected", async () => {
    const seq = dueSequence("campaign");
    listSalesSequences.mockResolvedValue([seq]);
    getOutlookConnection.mockResolvedValue(connectedOutlook());

    const result = await handler();
    expect(result.sent).toBe(1);
    expect(sesSend).toHaveBeenCalled();
    expect(sendOutlookMail).not.toHaveBeenCalled();
    expect(incrementSalesCampaignStat).toHaveBeenCalledWith("bulk_psap_1", "sent");
    expect(recordSalesSend).toHaveBeenCalled();
  });

  it("sends newsletter steps via SES even when Outlook is connected", async () => {
    const seq = dueSequence("newsletter");
    seq.approvedBy = "jeff";
    seq.approvedAt = new Date().toISOString();
    listSalesSequences.mockResolvedValue([seq]);
    getOutlookConnection.mockResolvedValue(connectedOutlook());

    const result = await handler();
    expect(result.sent).toBe(1);
    expect(sesSend).toHaveBeenCalled();
    expect(sendOutlookMail).not.toHaveBeenCalled();
  });

  it("sends 1:1 RFP steps through the connected Outlook mailbox", async () => {
    const seq = dueSequence("rfp_signal");
    listSalesSequences.mockResolvedValue([seq]);
    getOutlookConnection.mockResolvedValue(connectedOutlook());

    const result = await handler();
    expect(result.sent).toBe(1);
    expect(sendOutlookMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "director@example.gov",
        subject: "Walkthrough",
      }),
    );
    expect(sesSend).not.toHaveBeenCalled();
  });

  it("logs only when SES mock is on for campaign mail", async () => {
    process.env.SES_MOCK = "1";
    listSalesSequences.mockResolvedValue([dueSequence("campaign")]);
    getOutlookConnection.mockResolvedValue(connectedOutlook());

    const result = await handler();
    expect(result.sent).toBe(1);
    expect(sesSend).not.toHaveBeenCalled();
    expect(sendOutlookMail).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RapidIqSalesSequence } from "rapid-cortex-shared";

const listSalesSequences = vi.fn(async () => [] as RapidIqSalesSequence[]);
const getOutlookConnection = vi.fn(async () => null);
const putOutlookConnection = vi.fn(async () => undefined);
const putSalesSequence = vi.fn(async () => undefined);
const recordSalesSend = vi.fn(async () => undefined);
const checkSuppression = vi.fn(async () => ({ suppressed: false as const }));
const sendOutlookMail = vi.fn(async () => undefined);
const ensureOutlookAccessToken = vi.fn(async () => ({ accessToken: "tok" }));
const isOutlookGraphMock = vi.fn(() => false);

vi.mock("../../../lib/rapid-iq/sales-automation-db.js", () => ({
  listSalesSequences: (...args: unknown[]) => listSalesSequences(...args),
  getOutlookConnection: (...args: unknown[]) => getOutlookConnection(...args),
  putOutlookConnection: (...args: unknown[]) => putOutlookConnection(...args),
  putSalesSequence: (...args: unknown[]) => putSalesSequence(...args),
  recordSalesSend: (...args: unknown[]) => recordSalesSend(...args),
  getSalesSequence: vi.fn(async () => null),
}));

vi.mock("../../../lib/rapid-iq/sales-automation-engine.js", () => ({
  checkSuppression: (...args: unknown[]) => checkSuppression(...args),
}));

vi.mock("../../../lib/rapid-iq/outlook-graph.js", () => ({
  sendOutlookMail: (...args: unknown[]) => sendOutlookMail(...args),
  ensureOutlookAccessToken: (...args: unknown[]) => ensureOutlookAccessToken(...args),
  isOutlookGraphMock: (...args: unknown[]) => isOutlookGraphMock(...args),
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
    send = vi.fn();
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { handler } from "./sales-automation-send.js";

function dueSequence(): RapidIqSalesSequence {
  return {
    sequenceId: "seq_1",
    triggerId: "campaign",
    triggerType: "campaign",
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
    attribution: {},
  };
}

describe("sales automation campaign send", () => {
  beforeEach(() => {
    listSalesSequences.mockReset().mockResolvedValue([]);
    getOutlookConnection.mockReset().mockResolvedValue(null);
    putOutlookConnection.mockReset();
    putSalesSequence.mockReset();
    recordSalesSend.mockReset();
    checkSuppression.mockReset().mockResolvedValue({ suppressed: false });
    sendOutlookMail.mockReset();
    ensureOutlookAccessToken.mockReset().mockResolvedValue({ accessToken: "tok" });
    isOutlookGraphMock.mockReset().mockReturnValue(false);
    process.env.ENABLE_SALES_AUTOMATION = "true";
    process.env.SES_MOCK = "1";
  });

  it("sends due campaign steps through the connected Outlook mailbox", async () => {
    const seq = dueSequence();
    listSalesSequences.mockResolvedValue([seq]);
    getOutlookConnection.mockResolvedValue({
      agencyId: "platform",
      mailbox: "hello@nexcortiq.us",
      mock: false,
      refreshTokenEnc: "enc",
      connectedBy: "u-admin",
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await handler();
    expect(result.sent).toBe(1);
    expect(sendOutlookMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "director@example.gov",
        subject: "Walkthrough",
      }),
    );
    expect(recordSalesSend).toHaveBeenCalled();
    expect(putSalesSequence).toHaveBeenCalled();
  });

  it("logs only when Outlook is connected in mock mode", async () => {
    listSalesSequences.mockResolvedValue([dueSequence()]);
    getOutlookConnection.mockResolvedValue({
      agencyId: "platform",
      mailbox: "hello@nexcortiq.us",
      mock: true,
      connectedBy: "u-admin",
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    isOutlookGraphMock.mockReturnValue(true);

    const result = await handler();
    expect(result.sent).toBe(1);
    expect(sendOutlookMail).not.toHaveBeenCalled();
  });
});

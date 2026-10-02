/**
 * ChatGPT Watch ingest upsert tests (mocked Dynamo).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignalIdByExternalKey = vi.fn();
const getSignal = vi.fn();
const putSignal = vi.fn();
const reserveExternalKey = vi.fn();
const putExternalKeyPointer = vi.fn();
const reserveHash = vi.fn();
const getSignalIdByHash = vi.fn();
const contentHash = vi.fn(() => "hash123");

vi.mock("../rapid-iq-pipeline-db.js", () => ({
  getSignalIdByExternalKey: (...a: unknown[]) => getSignalIdByExternalKey(...a),
  getSignal: (...a: unknown[]) => getSignal(...a),
  putSignal: (...a: unknown[]) => putSignal(...a),
  reserveExternalKey: (...a: unknown[]) => reserveExternalKey(...a),
  putExternalKeyPointer: (...a: unknown[]) => putExternalKeyPointer(...a),
  reserveHash: (...a: unknown[]) => reserveHash(...a),
  getSignalIdByHash: (...a: unknown[]) => getSignalIdByHash(...a),
  contentHash: (...a: unknown[]) => contentHash(...a),
}));

import { ingestWatchSignal } from "../ingest-watch-signal.js";
import type { RapidIqPipelineSignal, RapidIqWatchIngestBody } from "rapid-cortex-shared";

const baseBody: RapidIqWatchIngestBody = {
  source: "chatgpt_watch",
  watch: "psap_rfp",
  external_key: "LA|CalcasieuParishSheriff|RFP-2027-10",
  signal_type: "rfp",
  vertical: "911_psap",
  agency: { name: "Calcasieu Parish Sheriff's Office", city: "Lake Charles", state: "LA" },
  opportunity: {
    title: "Public Safety Software",
    solicitation_number: "RFP 2027-10",
    posted_date: "2026-09-22",
    due_date: "2026-11-13",
    estimated_value: null,
    estimated_contract_value: null,
    project_budget: null,
    procurement_url: "https://example.gov/rfp/2027-10",
    status: "open",
  },
  qualification: { fit: "high", strategy: "partner", reason: "CAD modernization" },
  next_action: "Identify CAD prime partners",
  evidence: [{ url: "https://example.gov/rfp/2027-10", source_type: "official_procurement" }],
};

function existingSignal(overrides: Partial<RapidIqPipelineSignal> = {}): RapidIqPipelineSignal {
  return {
    signalId: "sig-1",
    sourceId: "chatgpt-watch",
    sourceUrl: "https://example.gov/rfp/2027-10",
    rawTitle: "Public Safety Software",
    rawSnippet: "CAD modernization",
    contentHash: "hash123",
    signalDate: "2026-09-22",
    ingestedAt: "2026-09-22T00:00:00.000Z",
    agencyName: "Calcasieu Parish Sheriff's Office",
    state: "LA",
    fitScore: 82,
    fitLabel: "high",
    status: "new",
    deadline: "2026-11-13",
    externalKey: "LA|CALCASIEUPARISHSHERIFF|RFP-2027-10",
    vertical: "911",
    activities: [],
    evidence: [],
    ...overrides,
  };
}

describe("ingestWatchSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reserveExternalKey.mockResolvedValue(undefined);
    reserveHash.mockResolvedValue(undefined);
    putSignal.mockResolvedValue(undefined);
    putExternalKeyPointer.mockResolvedValue(undefined);
    getSignalIdByHash.mockResolvedValue(null);
  });

  it("creates a new inbox signal for an unknown external_key", async () => {
    getSignalIdByExternalKey.mockResolvedValue(null);
    const result = await ingestWatchSignal(baseBody);
    expect(result.action).toBe("created");
    expect(result.signal.sourceId).toBe("chatgpt-watch");
    expect(result.signal.status).toBe("new");
    expect(result.signal.externalKey).toBe("LA|CALCASIEUPARISHSHERIFF|RFP-2027-10");
    expect(result.signal.vertical).toBe("911");
    expect(result.signal.watchStrategy).toBe("partner");
    expect(result.signal.solicitationNumber).toBe("RFP 2027-10");
    expect(putSignal).toHaveBeenCalledOnce();
    expect(reserveExternalKey).toHaveBeenCalledOnce();
  });

  it("does not create a CRM lead or pipeline push (status stays new)", async () => {
    getSignalIdByExternalKey.mockResolvedValue(null);
    const result = await ingestWatchSignal(baseBody);
    expect(result.signal.status).toBe("new");
    expect(result.signal.crmLeadId).toBeUndefined();
    expect(result.signal.pushedAt).toBeUndefined();
  });

  it("updates deadline on the same external_key instead of duplicating", async () => {
    getSignalIdByExternalKey.mockResolvedValue("sig-1");
    getSignal.mockResolvedValue(existingSignal());
    const result = await ingestWatchSignal({
      ...baseBody,
      opportunity: {
        ...baseBody.opportunity,
        due_date: "2026-11-30",
        status: "updated",
      },
      lifecycle: { change_type: "deadline_change", summary: "Extended" },
    });
    expect(result.action).toBe("updated");
    expect(result.signal.signalId).toBe("sig-1");
    expect(result.signal.deadline).toBe("2026-11-30");
    expect(result.signal.watchUpdated).toBe(true);
    expect(result.changes).toContain("due_date");
    expect(result.signal.activities?.[0]?.changeType).toBe("deadline_change");
    expect(putSignal).toHaveBeenCalledOnce();
    expect(reserveExternalKey).not.toHaveBeenCalled();
  });

  it("returns unchanged when payload_hash matches", async () => {
    const { watchPayloadHash } = await import("rapid-cortex-shared");
    const body = { ...baseBody };
    const hash = watchPayloadHash({
      ...body,
      external_key: "LA|CALCASIEUPARISHSHERIFF|RFP-2027-10",
    });
    getSignalIdByExternalKey.mockResolvedValue("sig-1");
    getSignal.mockResolvedValue(existingSignal({ watchPayloadHash: hash }));
    const result = await ingestWatchSignal(body);
    expect(result.action).toBe("unchanged");
    expect(putSignal).not.toHaveBeenCalled();
  });

  it("never copies project_budget into estimated contract value", async () => {
    getSignalIdByExternalKey.mockResolvedValue(null);
    const result = await ingestWatchSignal({
      ...baseBody,
      signal_type: "early_signal",
      external_key: "GA|TroupCountyE911|E911NextGen|FY2027",
      opportunity: {
        ...baseBody.opportunity,
        title: "E911 Next Gen infrastructure upgrade",
        solicitation_number: null,
        estimated_value: null,
        estimated_contract_value: null,
        project_budget: 381144.05,
        procurement_url: "https://example.gov/troup/e911",
        status: "unknown",
      },
    });
    expect(result.signal.projectBudget).toBe(381144.05);
    expect(result.signal.dollarAmount).toBeUndefined();
    expect(result.signal.estimatedContractValue).toBeUndefined();
    expect(result.signal.procurementStage).toBe("early-awareness");
  });

  it("flags possible duplicate when solicitation hash already exists", async () => {
    getSignalIdByExternalKey.mockResolvedValue(null);
    getSignalIdByHash.mockResolvedValue("sig-other");
    const result = await ingestWatchSignal({
      ...baseBody,
      external_key: "LA|OtherAgency|RFP-2027-10",
    });
    expect(result.signal.possibleDuplicate).toBe(true);
    expect(result.signal.possibleDuplicateOf).toBe("sig-other");
  });
});

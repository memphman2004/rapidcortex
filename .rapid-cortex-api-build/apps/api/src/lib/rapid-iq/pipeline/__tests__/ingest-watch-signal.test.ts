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
const contentHash = vi.fn(() => "hash123");

vi.mock("../rapid-iq-pipeline-db.js", () => ({
  getSignalIdByExternalKey: (...a: unknown[]) => getSignalIdByExternalKey(...a),
  getSignal: (...a: unknown[]) => getSignal(...a),
  putSignal: (...a: unknown[]) => putSignal(...a),
  reserveExternalKey: (...a: unknown[]) => reserveExternalKey(...a),
  putExternalKeyPointer: (...a: unknown[]) => putExternalKeyPointer(...a),
  reserveHash: (...a: unknown[]) => reserveHash(...a),
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
    externalKey: "LA|CalcasieuParishSheriff|RFP-2027-10",
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
  });

  it("creates a new inbox signal for an unknown external_key", async () => {
    getSignalIdByExternalKey.mockResolvedValue(null);
    const result = await ingestWatchSignal(baseBody);
    expect(result.action).toBe("created");
    expect(result.signal.sourceId).toBe("chatgpt-watch");
    expect(result.signal.status).toBe("new");
    expect(result.signal.externalKey).toBe(baseBody.external_key);
    expect(result.signal.vertical).toBe("911");
    expect(putSignal).toHaveBeenCalledOnce();
    expect(reserveExternalKey).toHaveBeenCalledOnce();
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
    expect(result.signal.activities?.[0]?.changeType).toBe("deadline_change");
    expect(putSignal).toHaveBeenCalledOnce();
    expect(reserveExternalKey).not.toHaveBeenCalled();
  });
});

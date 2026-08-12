import { describe, expect, it } from "vitest";
import {
  RAPID_IQ_PIPELINE_SOURCE_IDS,
  RAPID_IQ_PIPELINE_SOURCE_LABELS,
} from "rapid-cortex-shared";
import { contentHash } from "../rapid-iq-pipeline-db.js";
import {
  FIFO_DEDUPE_ID_MAX_LEN,
  fifoDedupeId,
} from "../../../../handlers/rapid-iq/pipeline/queue-raw-signal.js";

describe("RAPID_IQ_PIPELINE_SOURCE_IDS (state ingestion expansion)", () => {
  it("includes the five new sources and not granicus", () => {
    expect(RAPID_IQ_PIPELINE_SOURCE_IDS).toContain("legistar-bulk");
    expect(RAPID_IQ_PIPELINE_SOURCE_IDS).toContain("socrata");
    expect(RAPID_IQ_PIPELINE_SOURCE_IDS).toContain("state-911-board");
    expect(RAPID_IQ_PIPELINE_SOURCE_IDS).toContain("state-arpa");
    expect(RAPID_IQ_PIPELINE_SOURCE_IDS).toContain("openlegislative");
    expect(RAPID_IQ_PIPELINE_SOURCE_IDS).not.toContain("granicus");
  });

  it("has labels for every source id", () => {
    for (const id of RAPID_IQ_PIPELINE_SOURCE_IDS) {
      expect(RAPID_IQ_PIPELINE_SOURCE_LABELS[id]).toBeTruthy();
    }
    expect(RAPID_IQ_PIPELINE_SOURCE_LABELS["legistar-bulk"]).toBe("County Minutes");
    expect(RAPID_IQ_PIPELINE_SOURCE_LABELS.socrata).toBe("State Contracts");
    expect(RAPID_IQ_PIPELINE_SOURCE_LABELS["state-911-board"]).toBe("911 Board");
    expect(RAPID_IQ_PIPELINE_SOURCE_LABELS["state-arpa"]).toBe("ARPA Dashboard");
    expect(RAPID_IQ_PIPELINE_SOURCE_LABELS.openlegislative).toBe("State Legislature");
  });
});

describe("FIFO MessageDeduplicationId", () => {
  it("caps length at 128 and hashes long keys", () => {
    const long = `socrata-TX-${"vendor".repeat(40)}-${"description".repeat(40)}-2026-07-06`;
    expect(long.length).toBeGreaterThan(FIFO_DEDUPE_ID_MAX_LEN);
    const id = fifoDedupeId(long);
    expect(id.length).toBeLessThanOrEqual(FIFO_DEDUPE_ID_MAX_LEN);
    expect(id).toMatch(/^[\w!=.-]+$/);
  });

  it("preserves short alphanumeric-safe ids", () => {
    expect(fifoDedupeId("legistar-jefferson-id-1-2")).toBe("legistar-jefferson-id-1-2");
  });
});

describe("contentHash length", () => {
  it("is ≤ 128 (and stable at 32 hex chars)", () => {
    const h = contentHash("Title", "snippet body for dedupe");
    expect(h.length).toBeLessThanOrEqual(FIFO_DEDUPE_ID_MAX_LEN);
    expect(h).toHaveLength(32);
  });
});

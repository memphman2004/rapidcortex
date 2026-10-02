import { describe, expect, it } from "vitest";
import { rapidIqWatchIngestRequestSchema } from "./pipeline-schemas.js";
import {
  normalizeWatchExternalKey,
  watchDeadlineBucket,
  watchPayloadHash,
} from "./watch-ingest-utils.js";

describe("rapidIqWatchIngestRequestSchema", () => {
  const valid = {
    source: "chatgpt_watch",
    watch: "psap_rfp",
    external_key: "MO|CityOfWentzville|26-364",
    signal_type: "rfp",
    vertical: "911_psap",
    agency: { name: "City of Wentzville", city: "Wentzville", state: "MO" },
    opportunity: {
      title: "Public Safety Software Replacement and Implementation Services",
      solicitation_number: "26-364",
      posted_date: "2026-09-29",
      due_date: "2026-10-20T14:00:00-05:00",
      estimated_value: null,
      estimated_contract_value: null,
      project_budget: null,
      procurement_url: "https://example.gov/procurement/26-364",
      status: "open",
    },
    qualification: {
      fit: "high",
      strategy: "direct",
      reason: "Gathering information before a future public-safety software acquisition.",
    },
    next_action: "Download the RFI and review requirements.",
    lifecycle: { change_type: "new", summary: "New RFI issued September 29, 2026." },
    evidence: [
      { url: "https://example.gov/procurement/26-364", source_type: "official_procurement" },
    ],
  };

  it("accepts a single watch payload", () => {
    const parsed = rapidIqWatchIngestRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("accepts unknown/null contact and null estimated value", () => {
    const parsed = rapidIqWatchIngestRequestSchema.safeParse({
      ...valid,
      contact: { name: null, title: null, email: null, phone: null },
      opportunity: { ...valid.opportunity, estimated_value: null },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts early_signal with project_budget only", () => {
    const parsed = rapidIqWatchIngestRequestSchema.safeParse({
      ...valid,
      signal_type: "early_signal",
      opportunity: {
        ...valid.opportunity,
        status: "unknown",
        project_budget: 381144.05,
        estimated_contract_value: null,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing procurement_url", () => {
    const parsed = rapidIqWatchIngestRequestSchema.safeParse({
      ...valid,
      opportunity: { title: "NG911 services" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid enum", () => {
    const parsed = rapidIqWatchIngestRequestSchema.safeParse({
      ...valid,
      signal_type: "not_a_type",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const parsed = rapidIqWatchIngestRequestSchema.safeParse({
      ...valid,
      opportunity: { ...valid.opportunity, procurement_url: "not-a-url" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("watch ingest utils", () => {
  it("normalizes external_key casing/whitespace without inventing suffixes", () => {
    expect(normalizeWatchExternalKey("  mo|CityOfWentzville|26-364  ")).toBe(
      "MO|CITYOFWENTZVILLE|26-364",
    );
  });

  it("hashes identical payloads the same way", () => {
    const a = { external_key: "A|B|1", title: "X" };
    const b = { title: "X", external_key: "A|B|1" };
    expect(watchPayloadHash(a)).toBe(watchPayloadHash(b));
  });

  it("classifies deadline buckets", () => {
    const now = new Date("2026-10-01T12:00:00.000Z");
    expect(watchDeadlineBucket("2026-09-30", now)).toBe("overdue");
    expect(watchDeadlineBucket("2026-10-01", now)).toBe("due_today");
    expect(watchDeadlineBucket("2026-10-03", now)).toBe("due_within_3_days");
    expect(watchDeadlineBucket("2026-10-07", now)).toBe("due_within_7_days");
    expect(watchDeadlineBucket("2026-10-14", now)).toBe("due_within_14_days");
    expect(watchDeadlineBucket("2026-12-01", now)).toBe("future");
    expect(watchDeadlineBucket(null, now)).toBe("unknown");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./queue-raw-signal.js", () => ({
  enqueueRawSignal: vi.fn(async () => true),
  enqueueMockIfEnabled: vi.fn(async () => false),
}));

import { enqueueRawSignal } from "./queue-raw-signal.js";
import { enqueueRelevantPage } from "./enqueue-crawled.js";
import { listLegistarRegistrySlugs } from "./ingest-legistar-bulk.js";
import { SOCRATA_SOURCES } from "./ingest-socrata.js";
import { TARGET_CFDA } from "./ingest-usa-spending.js";

describe("verified ingest sources", () => {
  it("uses live Socrata dataset IDs", () => {
    const ids = SOCRATA_SOURCES.map((s) => s.datasetId);
    expect(ids).toContain("vipt-h4ye");
    expect(ids).toContain("rsxa-ify5");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("p86d-xgke");
  });

  it("covers SLFRF and 911 grant CFDA numbers", () => {
    expect(TARGET_CFDA).toContain("21.027");
    expect(TARGET_CFDA).toContain("20.615");
  });

  it("loads a unique Legistar client registry instead of /v1/clients", () => {
    const slugs = listLegistarRegistrySlugs();
    expect(slugs.length).toBeGreaterThan(20);
    expect(slugs).toContain("austintexas");
    expect(slugs).toContain("idahofalls");
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("enqueueRelevantPage", () => {
  beforeEach(() => {
    vi.mocked(enqueueRawSignal).mockClear();
    vi.mocked(enqueueRawSignal).mockResolvedValue(true);
  });

  it("force-enqueues civic registry landing pages even without CAD keywords", async () => {
    const n = await enqueueRelevantPage(
      "civiclerk",
      "https://example.com/agendas",
      "City of Raleigh",
      "<html><body><a href='/x'>Home</a></body></html>",
      { agencyName: "City of Raleigh", state: "NC" },
      8,
      { forcePage: true },
    );
    expect(n).toBeGreaterThanOrEqual(1);
    expect(enqueueRawSignal).toHaveBeenCalled();
    const month = new Date().toISOString().slice(0, 7);
    expect(vi.mocked(enqueueRawSignal).mock.calls[0]?.[1]).toMatchObject({
      dedupeId: `civiclerk-https://example.com/agendas-${month}`,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  deleteClaim,
  listActivityReports,
  listClaims,
  putActivityReport,
  putClaim,
  putRoiSession,
  getRoiSession,
  salesTablesConfigured,
} from "./sales-store";

describe("sales-store (memory fallback)", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [
      "ROI_SESSIONS_TABLE_NAME",
      "SALES_ACTIVITY_TABLE_NAME",
      "SALES_CLAIMS_TABLE_NAME",
      "SALES_RFP_TABLE_NAME",
      "FREE_TIER_REGISTRATIONS_TABLE_NAME",
    ]) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    // Reset module memory via unique keys each run
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("reports tables unconfigured when env unset", () => {
    expect(salesTablesConfigured()).toBe(false);
  });

  it("persists ROI sessions in memory", async () => {
    await putRoiSession({
      roiToken: "tok_mem_1",
      inputs: { agencyName: "Test" },
      createdByEmail: "a@b.co",
      createdAt: "2026-01-01T00:00:00.000Z",
      ttl: 1,
    });
    const got = await getRoiSession("tok_mem_1");
    expect(got?.roiToken).toBe("tok_mem_1");
  });

  it("upserts activity by weekOf", async () => {
    const email = "sales@example.com";
    await putActivityReport(email, {
      weekOf: "2026-09-22",
      callsMade: 1,
      submittedAt: "2026-09-22T12:00:00.000Z",
    });
    await putActivityReport(email, {
      weekOf: "2026-09-22",
      callsMade: 5,
      submittedAt: "2026-09-23T12:00:00.000Z",
    });
    const list = await listActivityReports(email);
    expect(list).toHaveLength(1);
    expect(list[0]?.callsMade).toBe(5);
  });

  it("claims soft-overwrite and owner-only delete", async () => {
    await putClaim({
      agencySlug: "demo-pd",
      claimedByEmail: "owner@example.com",
      agencyName: "Demo PD",
    });
    await putClaim({
      agencySlug: "demo-pd",
      claimedByEmail: "other@example.com",
      agencyName: "Demo PD",
    });
    const all = await listClaims();
    const row = all.find((c) => c.agencySlug === "demo-pd");
    expect(row?.claimedByEmail).toBe("other@example.com");
    expect(await deleteClaim("demo-pd", "owner@example.com")).toBe(false);
    expect(await deleteClaim("demo-pd", "other@example.com")).toBe(true);
  });
});

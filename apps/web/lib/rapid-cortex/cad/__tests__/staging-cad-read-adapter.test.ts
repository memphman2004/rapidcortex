import { describe, expect, it } from "vitest";
import { StagingCadReadAdapter } from "../staging-cad-read-adapter";

describe("StagingCadReadAdapter", () => {
  const adapter = new StagingCadReadAdapter();

  it("returns healthy staging health", async () => {
    const h = await adapter.healthCheck();
    expect(h.ok).toBe(true);
    expect(h.mode).toBe("read_only");
  });

  it("lists active incidents with vendor-neutral fields", async () => {
    const rows = await adapter.listActiveIncidents();
    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0]!;
    expect(first.incidentId).toBeTruthy();
    expect(first.externalCadId).toBeTruthy();
    expect(Number.isFinite(first.latitude)).toBe(true);
    expect(Number.isFinite(first.longitude)).toBe(true);
  });

  it("looks up incidents by id", async () => {
    const rows = await adapter.listActiveIncidents();
    const id = rows[0]!.incidentId;
    const one = await adapter.getIncidentById(id);
    expect(one?.incidentId).toBe(id);
  });
});

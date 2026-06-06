import { afterEach, describe, expect, it } from "vitest";
import { CadWritebackService } from "@/lib/rapid-cortex/cad/writeback/cad-writeback-service";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("CadWritebackService", () => {
  it("requires approval before write-back", async () => {
    process.env.CAD_VENDOR = "mock";
    process.env.RAPID_CORTEX_CAD_MODE = "assisted_writeback";
    const service = new CadWritebackService();
    const result = await service.executeWriteback({
      agencyId: "demo-agency",
      incidentId: "INC-1001",
      action: "addNarrativeNote",
      approvalStatus: "pending",
      requestedBy: "dispatcher-1",
      requestPayload: {
        agencyId: "demo-agency",
        incidentId: "INC-1001",
        note: "Pending approval note",
        createdBy: "dispatcher-1",
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });

  it("blocks dangerous actions", async () => {
    process.env.CAD_VENDOR = "mock";
    process.env.RAPID_CORTEX_CAD_MODE = "assisted_writeback";
    const service = new CadWritebackService();
    const result = await service.executeWriteback({
      agencyId: "demo-agency",
      incidentId: "INC-1001",
      action: "closeIncident",
      approvalStatus: "approved",
      approvedBy: "supervisor-1",
      requestedBy: "dispatcher-1",
      requestPayload: { reason: "manual close" },
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });

  it("creates audit events around approved write-back", async () => {
    process.env.CAD_VENDOR = "mock";
    process.env.RAPID_CORTEX_CAD_MODE = "assisted_writeback";
    const service = new CadWritebackService();
    const result = await service.executeWriteback({
      agencyId: "demo-agency",
      incidentId: "INC-1001",
      action: "updateDisposition",
      approvalStatus: "approved",
      approvedBy: "supervisor-1",
      requestedBy: "dispatcher-1",
      requestPayload: {
        agencyId: "demo-agency",
        incidentId: "INC-1001",
        disposition: "cleared",
        updatedBy: "supervisor-1",
        updatedAt: new Date().toISOString(),
      },
    });
    expect(result.ok).toBe(true);
    const events = service.listRecentAuditEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("returns not configured behavior for placeholder vendor adapters", async () => {
    process.env.CAD_VENDOR = "tyler";
    process.env.RAPID_CORTEX_CAD_MODE = "assisted_writeback";
    const service = new CadWritebackService();
    const result = await service.executeWriteback({
      agencyId: "demo-agency",
      incidentId: "INC-1001",
      action: "addNarrativeNote",
      approvalStatus: "approved",
      approvedBy: "supervisor-1",
      requestedBy: "dispatcher-1",
      requestPayload: {
        agencyId: "demo-agency",
        incidentId: "INC-1001",
        note: "Test note",
        createdBy: "dispatcher-1",
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("NOT_CONFIGURED");
  });
});

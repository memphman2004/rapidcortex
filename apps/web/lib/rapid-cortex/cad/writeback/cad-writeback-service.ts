import type { CadAdapter } from "@/lib/rapid-cortex/cad/cad-adapter";
import { CadAdapterFactory, readCadConnectionConfig } from "@/lib/rapid-cortex/cad/cad-adapter-factory";
import { CadAuditService } from "@/lib/rapid-cortex/cad/audit/cad-audit-service";
import type {
  CadAdapterResult,
  CadDispositionUpdate,
  CadIncident,
  CadMediaLink,
  CadNarrativeNote,
  CadVendor,
  CadWriteAction,
  CadWriteBackRequest,
} from "@/lib/rapid-cortex/cad/types";

const BLOCKED_ACTIONS = new Set<CadWriteAction>([
  "dispatchUnit",
  "changePriority",
  "closeIncident",
  "deleteIncident",
]);

type WritebackSuccess = {
  incident: CadIncident;
  action: CadWriteAction;
};

const pendingWritebackRequests = new Map<string, CadWriteBackRequest>();

export class CadWritebackService {
  constructor(
    private readonly adapterFactory = new CadAdapterFactory(),
    private readonly auditService = new CadAuditService(),
  ) {}

  private validateRequest(request: CadWriteBackRequest): string | null {
    if (!request.agencyId?.trim()) return "agencyId is required.";
    if (!request.incidentId?.trim()) return "incidentId is required.";
    if (!request.requestedBy?.trim()) return "requestedBy is required.";
    if (request.approvalStatus !== "approved") {
      return "Write-back requires approvalStatus === 'approved'.";
    }
    if (!request.approvedBy?.trim()) return "approvedBy is required for approved write-back.";
    if (BLOCKED_ACTIONS.has(request.action)) {
      return `Action '${request.action}' is blocked by safety policy.`;
    }
    return null;
  }

  private async recordStart(request: CadWriteBackRequest, vendor: CadVendor): Promise<void> {
    await this.auditService.record({
      agencyId: request.agencyId,
      userId: request.requestedBy,
      incidentId: request.incidentId,
      cadVendor: vendor,
      action: request.action,
      requestPayload: request.requestPayload,
      resultStatus: "blocked",
      timestamp: new Date().toISOString(),
      approvalStatus: request.approvalStatus,
      approvedBy: request.approvedBy,
    });
  }

  async executeWriteback(
    request: CadWriteBackRequest,
  ): Promise<CadAdapterResult<WritebackSuccess>> {
    const config = readCadConnectionConfig(request.agencyId);
    const adapter: CadAdapter = this.adapterFactory.create(config);
    const validationError = this.validateRequest(request);
    if (validationError) {
      await this.recordStart(request, config.vendor);
      await this.auditService.record({
        agencyId: request.agencyId,
        userId: request.requestedBy,
        incidentId: request.incidentId,
        cadVendor: config.vendor,
        action: request.action,
        requestPayload: request.requestPayload,
        resultStatus: "failed",
        errorMessage: validationError,
        timestamp: new Date().toISOString(),
        approvalStatus: request.approvalStatus,
        approvedBy: request.approvedBy,
      });
      return {
        ok: false,
        vendor: config.vendor,
        error: { code: "VALIDATION_ERROR", message: validationError },
      };
    }

    await this.auditService.record({
      agencyId: request.agencyId,
      userId: request.requestedBy,
      incidentId: request.incidentId,
      cadVendor: config.vendor,
      action: request.action,
      requestPayload: request.requestPayload,
      resultStatus: "blocked",
      timestamp: new Date().toISOString(),
      approvalStatus: request.approvalStatus,
      approvedBy: request.approvedBy,
    });

    let adapterResult: CadAdapterResult<CadIncident>;
    if (request.action === "addNarrativeNote") {
      adapterResult = await adapter.addNarrativeNote(
        request.incidentId,
        request.requestPayload as CadNarrativeNote,
      );
    } else if (request.action === "attachMediaLink") {
      adapterResult = await adapter.attachMediaLink(
        request.incidentId,
        request.requestPayload as CadMediaLink,
      );
    } else {
      adapterResult = await adapter.updateDisposition(
        request.incidentId,
        request.requestPayload as CadDispositionUpdate,
      );
    }

    await this.auditService.record({
      agencyId: request.agencyId,
      userId: request.requestedBy,
      incidentId: request.incidentId,
      cadVendor: config.vendor,
      action: request.action,
      requestPayload: request.requestPayload,
      resultStatus: adapterResult.ok ? "success" : "failed",
      errorMessage: adapterResult.error?.message,
      timestamp: new Date().toISOString(),
      approvalStatus: request.approvalStatus,
      approvedBy: request.approvedBy,
    });

    if (!adapterResult.ok || !adapterResult.data) {
      return {
        ok: false,
        vendor: config.vendor,
        error: adapterResult.error ?? {
          code: "UNKNOWN_ERROR",
          message: "CAD write-back failed without a detailed error.",
        },
      };
    }

    return {
      ok: true,
      vendor: config.vendor,
      data: {
        action: request.action,
        incident: adapterResult.data,
      },
    };
  }

  listRecentAuditEvents(limit = 50) {
    return this.auditService.listRecent(limit);
  }

  createWritebackRequest(
    request: Omit<CadWriteBackRequest, "approvalStatus" | "approvedBy">,
  ): CadWriteBackRequest {
    const queued: CadWriteBackRequest = {
      ...request,
      approvalStatus: "pending",
      requestedAt: request.requestedAt ?? new Date().toISOString(),
    };
    const key = `${queued.agencyId}:${queued.incidentId}:${queued.action}:${queued.requestedAt}`;
    pendingWritebackRequests.set(key, queued);
    return queued;
  }

  listPendingRequests(agencyId: string): CadWriteBackRequest[] {
    return [...pendingWritebackRequests.values()].filter((request) => request.agencyId === agencyId);
  }

  getPendingRequest(requestedAt: string, agencyId: string, incidentId: string, action: CadWriteAction) {
    const key = `${agencyId}:${incidentId}:${action}:${requestedAt}`;
    return pendingWritebackRequests.get(key) ?? null;
  }
}

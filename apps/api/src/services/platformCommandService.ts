import type { AuditEvent, UserContext } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { buildIntegrationStatusPayload } from "../lib/integration-surface.js";
import { AdminUserService } from "./adminUserService.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";

const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const incidentRepo = new IncidentRepository();
const adminUsers = new AdminUserService();

const ACTIVE_AGENCY = new Set(["active", "pilot"]);

export class PlatformCommandService {
  async getSummary(user: UserContext) {
    if (!isRcsuperadmin(user)) throw new Error("FORBIDDEN");
    const agencies = await agencyRepo.listRecent(500);
    const cognitoUsers = await adminUsers.list(user);
    const usersActive = cognitoUsers.filter((u) => u.enabled).length;
    const onboardingAttention = agencies.filter((a) => {
      const st = a.status;
      if (st === "draft") return true;
      const steps = a.config.platformOnboarding?.steps;
      if (!steps) return st !== "active";
      return Object.values(steps).some((v) => v === "pending" || v === "blocked");
    }).length;
    const agenciesWithBlockers = agencies.filter((a) => {
      const s = a.config.platformOnboarding?.steps;
      return s && Object.values(s).some((v) => v === "blocked");
    }).length;

    let liveIncidents = 0;
    for (const a of agencies.slice(0, 50)) {
      const recent = await incidentRepo.listByAgencyWithLimit(a.agencyId, 150);
      liveIncidents += recent.filter((i) => i.status === "active").length;
    }

    const firstAgencyId = agencies[0]?.agencyId ?? "___none___";
    const integrationSnapshot = buildIntegrationStatusPayload(firstAgencyId);

    const openPilotOrDraft = agencies.filter(
      (a) => a.status === "draft" || a.status === "pilot" || a.type === "pilot",
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        agencies: agencies.length,
        activeAgencies: agencies.filter((a) => ACTIVE_AGENCY.has(a.status)).length,
        users: cognitoUsers.length,
        activeUsers: usersActive,
        liveIncidents,
        onboardingItemsNeedingAttention: onboardingAttention,
        agenciesWithOnboardingBlockers: agenciesWithBlockers,
        pilotOrDraftAgencies: openPilotOrDraft,
      },
      /** Deployment-level integration signals (not per-tenant). */
      integrationSnapshot,
      /** Hint for UI when no agencies exist. */
      hasAgencies: agencies.length > 0,
    };
  }

  /**
   * Merge recent audit rows across agencies (newest first). For platform operators only;
   * caps work per agency to control Dynamo read cost.
   */
  async listGlobalAudit(
    user: UserContext,
    opts: {
      limit: number;
      perAgencyCap: number;
      agencyId?: string;
      typePrefix?: string;
      fromIso?: string;
      toIso?: string;
    },
  ): Promise<AuditEvent[]> {
    if (!isRcsuperadmin(user)) throw new Error("FORBIDDEN");
    const limit = Math.min(200, Math.max(1, opts.limit));
    const perCap = Math.min(100, Math.max(5, opts.perAgencyCap));
    const from = opts.fromIso;
    const to = opts.toIso;
    const typeFilter = opts.typePrefix?.trim();

    const collect = async (agencyId: string): Promise<AuditEvent[]> => {
      if (from && to) {
        return auditRepo.listByAgencyBetween(agencyId, from, to, perCap);
      }
      return auditRepo.listByAgency(agencyId, perCap);
    };

    if (opts.agencyId) {
      let rows = await collect(opts.agencyId);
      rows = applyAuditFilters(rows, typeFilter, from, to);
      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return rows.slice(0, limit);
    }

    const agencies = await agencyRepo.listRecent(300);
    const chunks = await Promise.all(agencies.map((a) => collect(a.agencyId)));
    let merged = chunks.flat();
    merged = applyAuditFilters(merged, typeFilter, from, to);
    merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return merged.slice(0, limit);
  }
}

function applyAuditFilters(
  rows: AuditEvent[],
  typePrefix: string | undefined,
  from: string | undefined,
  to: string | undefined,
): AuditEvent[] {
  let out = rows;
  if (typePrefix) {
    out = out.filter((e) => e.type.startsWith(typePrefix));
  }
  if (from) {
    out = out.filter((e) => e.createdAt >= from);
  }
  if (to) {
    out = out.filter((e) => e.createdAt <= to);
  }
  return out;
}

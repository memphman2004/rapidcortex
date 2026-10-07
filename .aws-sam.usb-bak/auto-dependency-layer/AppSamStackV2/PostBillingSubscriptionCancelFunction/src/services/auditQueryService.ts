import { AuditRepository } from "../repositories/auditRepository.js";
import { normalizeAuditEventForApi } from "../lib/auditDisplay.js";
import type { AuditEvent, UserContext } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { requireRole } from "../lib/authz.js";

const repo = new AuditRepository();

export class AuditQueryService {
  async listForUser(user: UserContext, limit: number): Promise<AuditEvent[]> {
    if (!requireRole(user, ["agencyadmin", "supervisor"]) && !isRcsuperadmin(user)) {
      throw new Error("FORBIDDEN");
    }
    /** Platform principals use sentinel agency; cross-tenant audit views need a follow-up GSI/query. */
    const rows = await repo.listByAgency(user.agencyId, limit);
    return rows.map((e) => normalizeAuditEventForApi(e));
  }
}

import { canAccessRcFinancePortal, isRcInternalOperator } from "../tenancy/principal.js";
import {
  SALES_CONTRACTOR_RC_ADMIN_PATH_PREFIXES,
  normalizeAppPathname,
  salesContractorMayAccessPath,
} from "./sales-contractor-paths.js";

export {
  SALES_CONTRACTOR_RC_ADMIN_PATH_PREFIXES,
  normalizeAppPathname,
  salesContractorMayAccessPath,
};

function roleToken(role: string | undefined | null): string {
  return String(role ?? "")
    .trim()
    .toLowerCase();
}

export function isSalesContractorRole(role: string | undefined | null): boolean {
  return roleToken(role) === "salescontractor";
}

/** Deployments map — RC operators + sales (read-only national pins). */
export function canAccessDeploymentsMap(role: string | undefined | null): boolean {
  return isRcInternalOperator(roleToken(role) || "") || isSalesContractorRole(role);
}

/** PSAP Prospects CRM — finance portal operators + sales contractors. */
export function canAccessPsapProspectsCrm(role: string | undefined | null): boolean {
  return canAccessRcFinancePortal(roleToken(role) || "") || isSalesContractorRole(role);
}

/** NexiQ / Conferences workspace — Rapid IQ operators + sales contractors. */
export function canAccessRapidIqWorkspace(role: string | undefined | null): boolean {
  const r = roleToken(role);
  return r === "rcsuperadmin" || r === "rcadmin" || r === "salescontractor";
}

/** Grant Success Program (not Access Overrides) — RC admin + sales. */
export function canAccessGrantSuccessProgram(role: string | undefined | null): boolean {
  const r = roleToken(role);
  return r === "rcsuperadmin" || r === "rcadmin" || r === "salescontractor";
}

/** Platform notices / onboarding packets / system health — RC operators + sales. */
export function canAccessSalesOpsReadSurfaces(role: string | undefined | null): boolean {
  return isRcInternalOperator(roleToken(role) || "") || isSalesContractorRole(role);
}

import { canAccessPsapProspectsCrm } from "../auth/sales-contractor-access.js";

/** Sales administrators approve or reject evidence. Representatives may submit it. */
export function canVerifyAgencyIntelligence(role: string | null | undefined): boolean {
  const token = String(role ?? "")
    .trim()
    .toLowerCase();
  return token === "rcsuperadmin" || token === "rcadmin";
}

export function canSubmitAgencyIntelligence(role: string | null | undefined): boolean {
  return canAccessPsapProspectsCrm(role);
}

export function canViewAgencyIntelligence(role: string | null | undefined): boolean {
  return canAccessPsapProspectsCrm(role);
}

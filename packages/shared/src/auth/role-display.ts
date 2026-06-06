import { ROLE_DISPLAY_LABELS, type RapidCortexRole } from "./rapid-cortex-roles.js";

/** Human-readable role name for the signed-in user's role (`custom:role`). */
export function getUserRoleDisplayLabel(role: RapidCortexRole | undefined | null): string {
  if (!role) return ROLE_DISPLAY_LABELS.dispatcher;
  return ROLE_DISPLAY_LABELS[role] ?? ROLE_DISPLAY_LABELS.dispatcher;
}

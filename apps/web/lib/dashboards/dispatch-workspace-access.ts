import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

/** Jurisdiction paths that constitute the live PSAP call-taking workspace. */
export const DISPATCH_LIVE_WORKSPACE_PREFIXES = [
  "/dashboard",
  "/dispatcher",
  "/demo",
  "/caller",
  "/transcription",
  "/translation",
  "/media",
  "/cad",
  "/incidents",
  "/ai-summary",
  "/alerts",
  "/calls",
  "/notes",
  "/shared-incoming",
] as const;

export function isDispatchLiveWorkspaceSubpath(subpath: string): boolean {
  return DISPATCH_LIVE_WORKSPACE_PREFIXES.some(
    (prefix) => subpath === prefix || subpath.startsWith(`${prefix}/`),
  );
}

/** Only dispatchers and supervisors may enter the live call workspace (operational separation). */
export function roleMayAccessDispatchLiveWorkspace(role: string): boolean {
  const effective = migrateLegacyRapidCortexRoleTokenValue(role.trim()) ?? role.trim();
  return effective === "dispatcher" || effective === "supervisor";
}

import type { UserContext } from "rapid-cortex-shared/types";

/** Friendly first name for dashboard greetings from session email. */
export function dashboardDisplayName(user: Pick<UserContext, "email">): string {
  const email = user.email ?? "";
  const local = email.split("@")[0]?.trim();
  if (!local) return "there";
  return local.replace(/[.+_-]/g, " ");
}

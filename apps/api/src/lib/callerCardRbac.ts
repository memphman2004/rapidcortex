import type { UserContext } from "rapid-cortex-shared";

/** Dispatcher+ roles that may view or edit the caller / premise data card. */
export function canAccessCallerCard(user: UserContext): boolean {
  if (user.role === "auditor") return false;
  return (
    user.role === "dispatcher" ||
    user.role === "supervisor" ||
    user.role === "agencyadmin" ||
    user.role === "rcsuperadmin"
  );
}

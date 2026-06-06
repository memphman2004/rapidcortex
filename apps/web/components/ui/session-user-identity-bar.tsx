"use client";

import { useSession } from "@/components/auth/session-context";
import { UserIdentityBar } from "@/components/ui/user-identity-bar";

/** Renders {@link UserIdentityBar} when the session provider has a signed-in user. */
export function SessionUserIdentityBar() {
  const { user } = useSession();
  if (!user) return null;
  return <UserIdentityBar email={user.email} role={user.role} agencyId={user.agencyId} />;
}

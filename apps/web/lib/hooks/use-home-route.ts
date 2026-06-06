"use client";

import { jurisdictionRoleHomeHrefForUser } from "@/lib/auth/role-home";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import type { UserContext } from "rapid-cortex-shared";

export function useHomeRoute(user: Pick<UserContext, "role" | "agencyId">): string {
  const jurisdictionSlug = useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();
  return jurisdictionRoleHomeHrefForUser(user, jurisdictionSlug);
}

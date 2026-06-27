"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSession } from "@/components/auth/session-context";
import { jurisdictionRoleHomeHrefForUser } from "@/lib/auth/role-home";
import { defaultJurisdictionSlug, marketingLoginPath } from "@/lib/marketing-links";

type MarketingOpenAppLinkProps = {
  children?: ReactNode;
  className?: string;
};

/** Session-aware workspace entry — matches former header Open app behavior. */
export function MarketingOpenAppLink({
  children = "Open App",
  className,
}: MarketingOpenAppLinkProps) {
  const { user, isLoading } = useSession();
  const href =
    !isLoading && user
      ? jurisdictionRoleHomeHrefForUser(user, defaultJurisdictionSlug())
      : marketingLoginPath();

  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  );
}

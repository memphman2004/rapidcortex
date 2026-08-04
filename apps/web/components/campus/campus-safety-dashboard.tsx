/**
 * Compatibility re-export — campus home UI lives in campus-console-home.tsx.
 */
"use client";

import { CampusConsoleHome } from "./campus-console-home";

export function CampusSafetyDashboard({
  agencyId,
  agencyName = "Campus",
  agencySlug = "campus",
  userEmail = "",
  userRole,
  displayName,
}: {
  agencyId: string;
  agencyName?: string;
  agencySlug?: string;
  linkBase?: string;
  userEmail?: string;
  userRole?: string;
  displayName?: string;
}) {
  const name =
    displayName?.trim() ||
    (userEmail.includes("@")
      ? userEmail.split("@")[0]!.replace(/[.+_-]/g, " ")
      : "Campus User");

  return (
    <CampusConsoleHome
      agencyId={agencyId}
      campusCode={agencySlug}
      agencyName={agencyName}
      displayName={name}
      userEmail={userEmail}
      userRole={userRole}
    />
  );
}

export { CampusConsoleHome } from "./campus-console-home";

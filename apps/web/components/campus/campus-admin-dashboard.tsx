/**
 * Compatibility re-export — campus admin home uses CampusConsoleHome.
 */
"use client";

import { CampusConsoleHome } from "./campus-console-home";

export interface CampusAdminDashboardProps {
  agencyId: string;
  campusCode: string;
  agencyName?: string;
  adminName?: string;
  adminEmail?: string;
  adminRole?: string;
}

export function CampusAdminDashboard({
  agencyId,
  campusCode,
  agencyName = "Campus",
  adminName = "Campus Admin",
  adminEmail,
  adminRole = "CAMPUS_ADMIN",
}: CampusAdminDashboardProps) {
  return (
    <CampusConsoleHome
      agencyId={agencyId}
      campusCode={campusCode}
      agencyName={agencyName}
      displayName={adminName}
      userEmail={adminEmail}
      userRole={adminRole}
    />
  );
}

export { CampusConsoleHome } from "./campus-console-home";

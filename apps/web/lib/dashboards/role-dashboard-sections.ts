import { isRcItAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { DashboardPrefix } from "./dashboard-access";

/** Which widgets appear on each role dashboard home (least-privilege UX). */
export type RoleDashboardSections = {
  stats: boolean;
  integrationHealth: boolean;
  /** CAD-style live incident queue — dispatcher/supervisor only. */
  liveOperationsIncidents: boolean;
  supervisorSla: boolean;
  supervisorActiveCalls: boolean;
  activityFeed: boolean;
  usageChart: boolean;
  securityAlerts: boolean;
  reports: boolean;
  platformNotices: boolean;
  executiveGrants: boolean;
  qaReviewQueue: boolean;
  agencyAdminQuickActions: boolean;
  itSecurityPosture: boolean;
  executiveTrends: boolean;
};

const SUPERVISOR_OPS: RoleDashboardSections = {
  stats: true,
  integrationHealth: true,
  liveOperationsIncidents: true,
  supervisorSla: true,
  supervisorActiveCalls: true,
  activityFeed: true,
  usageChart: true,
  securityAlerts: true,
  reports: false,
  platformNotices: false,
  executiveGrants: false,
  qaReviewQueue: false,
  agencyAdminQuickActions: false,
  itSecurityPosture: false,
  executiveTrends: false,
};

const SECTIONS_BY_PREFIX: Record<DashboardPrefix, RoleDashboardSections> = {
  "rc-admin": {
    stats: false,
    integrationHealth: true,
    liveOperationsIncidents: false,
    supervisorSla: false,
    supervisorActiveCalls: false,
    activityFeed: false,
    usageChart: false,
    securityAlerts: false,
    reports: false,
    platformNotices: true,
    executiveGrants: false,
    qaReviewQueue: false,
    agencyAdminQuickActions: false,
    itSecurityPosture: false,
    executiveTrends: false,
  },
  supervisor: SUPERVISOR_OPS,
  dispatcher: {
    stats: true,
    integrationHealth: true,
    liveOperationsIncidents: true,
    supervisorSla: false,
    supervisorActiveCalls: false,
    activityFeed: true,
    usageChart: false,
    securityAlerts: false,
    reports: false,
    platformNotices: false,
    executiveGrants: false,
    qaReviewQueue: false,
    agencyAdminQuickActions: false,
    itSecurityPosture: false,
    executiveTrends: false,
  },
  qa: {
    stats: true,
    integrationHealth: false,
    liveOperationsIncidents: false,
    supervisorSla: false,
    supervisorActiveCalls: false,
    activityFeed: true,
    usageChart: false,
    securityAlerts: false,
    reports: true,
    platformNotices: false,
    executiveGrants: false,
    qaReviewQueue: true,
    agencyAdminQuickActions: false,
    itSecurityPosture: false,
    executiveTrends: false,
  },
  "agency-admin": {
    stats: true,
    integrationHealth: true,
    liveOperationsIncidents: false,
    supervisorSla: false,
    supervisorActiveCalls: false,
    activityFeed: true,
    usageChart: false,
    securityAlerts: false,
    reports: true,
    platformNotices: false,
    executiveGrants: false,
    qaReviewQueue: false,
    agencyAdminQuickActions: true,
    itSecurityPosture: false,
    executiveTrends: false,
  },
  "it-security": {
    stats: true,
    integrationHealth: true,
    liveOperationsIncidents: false,
    supervisorSla: false,
    supervisorActiveCalls: false,
    activityFeed: true,
    usageChart: false,
    securityAlerts: true,
    reports: false,
    platformNotices: false,
    executiveGrants: false,
    qaReviewQueue: false,
    agencyAdminQuickActions: false,
    itSecurityPosture: true,
    executiveTrends: false,
  },
  executive: {
    stats: true,
    integrationHealth: false,
    liveOperationsIncidents: false,
    supervisorSla: false,
    supervisorActiveCalls: false,
    activityFeed: true,
    usageChart: false,
    securityAlerts: false,
    reports: true,
    platformNotices: false,
    executiveGrants: false,
    qaReviewQueue: false,
    agencyAdminQuickActions: false,
    itSecurityPosture: false,
    executiveTrends: true,
  },
  "hospital-admin": {
    stats: false,
    integrationHealth: false,
    liveOperationsIncidents: false,
    supervisorSla: false,
    supervisorActiveCalls: false,
    activityFeed: false,
    usageChart: false,
    securityAlerts: false,
    reports: false,
    platformNotices: false,
    executiveGrants: false,
    qaReviewQueue: false,
    agencyAdminQuickActions: false,
    itSecurityPosture: false,
    executiveTrends: false,
  },
  "hospital-staff": {
    stats: false,
    integrationHealth: false,
    liveOperationsIncidents: false,
    supervisorSla: false,
    supervisorActiveCalls: false,
    activityFeed: false,
    usageChart: false,
    securityAlerts: false,
    reports: false,
    platformNotices: false,
    executiveGrants: false,
    qaReviewQueue: false,
    agencyAdminQuickActions: false,
    itSecurityPosture: false,
    executiveTrends: false,
  },
};

function getRcAdminSections(role: string): RoleDashboardSections {
  const r = migrateLegacyRapidCortexRoleTokenValue(role) ?? role;
  if (r === "rcadmin") {
    return {
      stats: true,
      integrationHealth: false,
      liveOperationsIncidents: false,
      supervisorSla: false,
      supervisorActiveCalls: false,
      activityFeed: true,
      usageChart: true,
      securityAlerts: false,
      reports: true,
      platformNotices: true,
      executiveGrants: false,
      qaReviewQueue: false,
      agencyAdminQuickActions: false,
      itSecurityPosture: false,
      executiveTrends: false,
    };
  }
  if (isRcItAdmin(r) && !isRcSuperAdmin(r)) {
    return {
      stats: false,
      integrationHealth: false,
      liveOperationsIncidents: false,
      supervisorSla: false,
      supervisorActiveCalls: false,
      activityFeed: false,
      usageChart: false,
      securityAlerts: false,
      reports: false,
      platformNotices: false,
      executiveGrants: false,
      qaReviewQueue: false,
      agencyAdminQuickActions: false,
      itSecurityPosture: false,
      executiveTrends: false,
    };
  }
  return SECTIONS_BY_PREFIX["rc-admin"];
}

export function getRoleDashboardSections(
  prefix: DashboardPrefix,
  role?: string,
): RoleDashboardSections {
  if (prefix === "rc-admin" && role) {
    return getRcAdminSections(role);
  }
  return SECTIONS_BY_PREFIX[prefix];
}

/** Role-specific overview copy (replaces generic dispatcher-style preview text). */
export function getRoleDashboardOverviewDescription(
  prefix: DashboardPrefix,
  agencyId: string | null,
): string {
  const agency = agencyId ?? "your agency";
  switch (prefix) {
    case "rc-admin":
      return "Live platform metrics from DynamoDB, Cognito, and deployment integration checks.";
    case "supervisor":
      return `Live operations overview for ${agency} — escalations, team workload, and active incidents.`;
    case "qa":
      return `Quality assurance queue and scoring for ${agency}. Review transcripts and coaching assignments — not a live dispatch console.`;
    case "agency-admin":
      return `Agency administration for ${agency} — users, billing, features, and compliance posture.`;
    case "it-security":
      return `Security operations for ${agency} — authentication, integrations, audit evidence, and export activity.`;
    case "executive":
      return `Executive briefing for ${agency} — trends, grant reporting, and aggregate performance (read-only).`;
    case "hospital-admin":
    case "hospital-staff":
      return "Hospital portal overview — use the facility dashboard for capacity and routing.";
    default:
      return `Overview scoped to your role at ${agency}.`;
  }
}

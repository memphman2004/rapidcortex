"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  ClipboardCheck,
  Eye,
  FileText,
  MessageCircle,
  Radio,
  UserCheck,
} from "lucide-react";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { useSession } from "@/components/auth/session-context";
import { isAuthConfigured, isAdminRole } from "@/lib/auth/roles";
import { fetchCadWritebackApprovals } from "@/lib/api";
import { SidebarHomeButton } from "@/components/ui/sidebar-home-button";
import { SidebarSignOutFooter } from "@/components/ui/sidebar-sign-out-footer";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  isAdminAnalyticsUiEnabled,
  isCadAdminUiEnabled,
  isCadWritebackUiEnabled,
  isDispatcherWellnessUiEnabled,
  isLiveVideoEnabled,
  isNonEmergencyTriageEnabled,
  isQaScoringEnabled,
  isReportsEnabled,
  isSopProtocolEnabled,
  isSupervisorPerformanceUiEnabled,
} from "@/lib/runtime-flags";
import { deriveAgencyConfigFromUser } from "@/lib/rapid-cortex/agency-config";
import { isFeatureEnabledForAgency } from "@/lib/rapid-cortex/entitlements";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { RC_ADMIN_SIDEBAR_NAV } from "@/lib/platform-command-nav";
import { isRingEnabled } from "@/src/features/connect/ring";

type DispatchNavItem = {
  path: string;
  label: string;
  icon?: typeof Eye;
};

const dispatcherOperationsBeforeHistory: DispatchNavItem[] = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/dispatcher", label: "Dispatcher" },
  { path: "/intake", label: "Intake" },
  { path: "/triage", label: "Triage" },
  { path: "/transcription", label: "Transcription" },
  { path: "/incidents", label: "Incidents" },
];

const dispatcherOperationsAfterHistory: DispatchNavItem[] = [{ path: "/media", label: "Media" }];

const supervisorInlineOperations: DispatchNavItem[] = [
  { path: "/supervisor/monitor", label: "Silent Monitor", icon: Eye },
  { path: "/supervisor/assist", label: "Supervisor Assist", icon: UserCheck },
];

const supervisorToolLinks: DispatchNavItem[] = [
  { path: "/supervisor/qa", label: "QA Review", icon: ClipboardCheck },
  { path: "/supervisor/coaching", label: "Coaching", icon: MessageCircle },
  { path: "/supervisor/performance", label: "Performance", icon: BarChart2 },
  { path: "/supervisor/command", label: "Command", icon: Radio },
  { path: "/supervisor/reports", label: "Reports", icon: FileText },
];

const adminLinksBase = [
  { path: "/admin", label: "Overview" },
  { path: "/admin/agency", label: "Agency" },
  { path: "/admin/users", label: "Users" },
  { path: "/admin/roles", label: "Roles" },
  { path: "/admin/features", label: "Features" },
  { path: "/admin/readiness", label: "Readiness" },
  { path: "/admin/audit", label: "Audit log" },
  { path: "/admin/audit-logs", label: "Audit logs" },
  { path: "/admin/billing", label: "Billing" },
  { path: "/admin/protocols", label: "Protocols" },
  { path: "/admin/integrations", label: "Integrations" },
  { path: "/admin/cad", label: "CAD" },
  { path: "/admin/security", label: "Security" },
  { path: "/admin/retention", label: "Retention" },
  { path: "/admin/settings", label: "Environment" },
] as const;

const adminQaLink = { path: "/admin/qa/templates", label: "QA templates" } as const;
const adminSopLink = { path: "/admin/protocols/sop", label: "SOP docs" } as const;
const adminTriageLink = { path: "/admin/triage/config", label: "Triage config" } as const;
const adminWellnessLink = { path: "/admin/wellness", label: "Wellness" } as const;
const adminAnalyticsLink = { path: "/admin/analytics", label: "Analytics" } as const;

/** Platform console lives outside jurisdiction routes. */
function resolveSideNavHref(path: string, to: (p: string) => string): string {
  if (path.startsWith("/rc-admin")) return path;
  return to(path);
}
const adminFeatureByPath: Record<string, string | undefined> = {
  "/admin/agency": "agency_admin_console",
  "/admin/roles": "role_based_access_control",
  "/admin/features": "agency_admin_console",
  "/admin/readiness": "agency_admin_console",
  "/admin/cad": "cad_discovery_workshop",
  "/admin/security": "custom_security_compliance_review",
  "/admin/audit-logs": "audit_logs",
  "/admin/retention": "data_retention_policy_controls",
};

export function SideNav() {
  const pathname = usePathname();
  const { user, isLoading } = useSession();
  const auth = isAuthConfigured();
  const to = useJurisdictionLink();
  const agencyConfig = deriveAgencyConfigFromUser(user ?? null);
  const featureEnabled = (featureId?: string) =>
    featureId ? isFeatureEnabledForAgency(agencyConfig, featureId) : true;

  const pendingWritebacksQ = useQuery({
    queryKey: ["cad-writeback-approvals", "pending-count"],
    queryFn: async () => {
      const r = await fetchCadWritebackApprovals({ status: "pending_approval" });
      return r.items.length;
    },
    enabled:
      Boolean(
        auth &&
          !isLoading &&
          (user?.role === "supervisor" || user?.role === "agencyit") &&
          isCadAdminUiEnabled() &&
          isCadWritebackUiEnabled(),
      ),
    refetchInterval: 30_000,
  });
  const pendingWritebackCount = pendingWritebacksQ.data ?? 0;
  const adminLinks = [
    ...adminLinksBase.slice(0, 5),
    ...(isQaScoringEnabled() ? [adminQaLink] : []),
    ...(isSopProtocolEnabled() ? [adminSopLink] : []),
    ...adminLinksBase.slice(5),
    ...(isNonEmergencyTriageEnabled() ? [adminTriageLink] : []),
    ...(isDispatcherWellnessUiEnabled() ? [adminWellnessLink] : []),
    ...(isAdminAnalyticsUiEnabled() ? [adminAnalyticsLink] : []),
  ];

  const rcPlatformOnly = Boolean(auth && !isLoading && user && isRcInternalOperator(user.role));
  const effectiveRole = migrateLegacyRapidCortexRoleTokenValue(user?.role ?? "") ?? user?.role ?? "";
  const isLiveOpsRole = effectiveRole === "dispatcher" || effectiveRole === "supervisor";
  const isSupervisorNavRole = Boolean(
    user &&
      (effectiveRole === "supervisor" ||
        user.role === "rcsuperadmin" ||
        user.role === "rcadmin" ||
        user.role === "rcitadmin"),
  );
  const isQaNavRole = effectiveRole === "analyst";
  const isAuditNavRole = effectiveRole === "auditor";
  const isAgencyItNavRole = effectiveRole === "agencyit";

  const mediaEnabled = isLiveVideoEnabled() || isRingEnabled();
  const showSupervisorTools = Boolean(auth && !isLoading && isSupervisorNavRole && !rcPlatformOnly);

  const qaNavLinks: DispatchNavItem[] = [
    { path: "/qa", label: "QA review", icon: ClipboardCheck },
    { path: "/history", label: "Transcripts", icon: FileText },
    { path: "/reports", label: "Reports", icon: FileText },
  ];

  const auditNavLinks: DispatchNavItem[] = [
    { path: "/audit", label: "Audit overview", icon: Eye },
    { path: "/history", label: "Incident history", icon: FileText },
    { path: "/reports", label: "Reports", icon: FileText },
  ];

  const agencyItNavLinks: DispatchNavItem[] = [
    { path: "/admin/security", label: "Security", icon: Eye },
    { path: "/admin/cad", label: "CAD health", icon: Radio },
    { path: "/admin/audit-logs", label: "Access logs", icon: FileText },
    { path: "/admin/integrations", label: "Integrations", icon: Radio },
  ];

  const operationsMain: DispatchNavItem[] = rcPlatformOnly
    ? []
    : isQaNavRole
      ? qaNavLinks
      : isAuditNavRole
        ? auditNavLinks
        : isAgencyItNavRole
          ? agencyItNavLinks
          : isLiveOpsRole
            ? [
                ...dispatcherOperationsBeforeHistory.filter((item) => {
                  if (item.path === "/dispatcher") return featureEnabled("dispatcher_console");
                  if (item.path === "/intake") return featureEnabled("ai_assisted_intake");
                  if (item.path === "/triage") return featureEnabled("call_triage_workflows");
                  if (item.path === "/transcription") return featureEnabled("live_transcription");
                  if (item.path === "/incidents") return featureEnabled("active_incident_view");
                  return true;
                }),
                ...(showSupervisorTools ? supervisorInlineOperations : []),
                { path: "/history", label: "History" },
                ...(mediaEnabled ? dispatcherOperationsAfterHistory : []),
              ]
            : isAdminRole(user?.role ?? "")
              ? [
                  { path: "/admin", label: "Agency overview" },
                  { path: "/history", label: "Incident history" },
                  { path: "/reports", label: "Reports" },
                ]
              : [];

  return (
    <nav
      className="flex h-full min-h-0 w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950/90 sm:w-[var(--rc-sidebar-ops)] xl:w-[var(--rc-sidebar-ops-xl)]"
      aria-label="Operations and administration"
    >
      <div className="min-h-0 flex-1 overflow-y-auto py-3 xl:py-4">
      {auth && !isLoading && user ? (
        <div className="px-2 pb-2">
          <SidebarHomeButton user={user} className="w-full" />
        </div>
      ) : null}
      {!rcPlatformOnly ? (
        <>
      <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 xl:pb-3">
        Operations
      </div>
      <ul className="flex flex-col gap-px px-2">
        {operationsMain.map(({ path, label, icon: Icon }) => {
          const href = resolveSideNavHref(path, to);
          const active =
            path === "/dashboard"
              ? pathname === href || pathname === `${href}/`
              : path.includes("?")
                ? pathname === href.split("?")[0] || pathname.startsWith(`${href.split("?")[0]}/`)
                : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={path}>
              <Link
                href={href}
                className={`block rounded-md px-3 py-1.5 text-[13px] font-medium leading-snug transition-colors xl:py-2 ${
                  active
                    ? "bg-slate-800 text-sky-300"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {Icon ? <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden /> : null}
                  {label}
                  {path === "/supervisor/assist" &&
                  user?.role === "supervisor" &&
                  isCadWritebackUiEnabled() &&
                  pendingWritebackCount > 0 ? (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {pendingWritebackCount > 99 ? "99+" : pendingWritebackCount}
                    </span>
                  ) : null}
                  {path.startsWith("/admin/cad") &&
                  (user?.role === "supervisor" || user?.role === "agencyit") &&
                  isCadWritebackUiEnabled() &&
                  pendingWritebackCount > 0 ? (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {pendingWritebackCount > 99 ? "99+" : pendingWritebackCount}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {showSupervisorTools ? (
        <>
          <div className="mx-3 mt-4 border-t border-slate-800" />
          <div className="mt-3 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 xl:pb-3">
            Supervisor
          </div>
          <ul className="flex flex-col gap-px px-2">
            {supervisorToolLinks
              .filter((item) => {
                if (item.path === "/supervisor/qa") return isQaScoringEnabled();
                if (item.path === "/supervisor/performance") return isSupervisorPerformanceUiEnabled();
                if (item.path === "/supervisor/reports") return isReportsEnabled();
                return true;
              })
              .map(({ path, label, icon: Icon }) => {
                const href = resolveSideNavHref(path, to);
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={path}>
                    <Link
                      href={href}
                      className={`block rounded-md px-3 py-1.5 text-[13px] font-medium leading-snug transition-colors xl:py-2 ${
                        active
                          ? "bg-slate-800 text-sky-300"
                          : "text-slate-300 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {Icon ? <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden /> : null}
                        {label}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </>
      ) : null}
        </>
      ) : null}

      {auth && !isLoading && user && isAdminRole(user.role) && !rcPlatformOnly && !isAgencyItNavRole ? (
        <>
          <div className="mt-6 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Administration
          </div>
          <ul className="flex flex-col gap-0.5 px-2">
            {adminLinks
              .filter(({ path }) => featureEnabled(adminFeatureByPath[path]))
              .map(({ path, label }) => {
              const href = to(path);
              const active =
                path === "/admin"
                  ? pathname === href
                  : path === "/admin/billing"
                    ? pathname.startsWith(`${to("/admin/billing")}`)
                    : path === "/admin/qa/templates"
                      ? pathname.startsWith(`${to("/admin/qa")}`)
                      : path === "/admin/protocols"
                        ? pathname === href
                        : path === "/admin/analytics"
                          ? pathname.startsWith(`${to("/admin/analytics")}`)
                          : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={path}>
                  <Link
                    href={href}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-slate-800 text-amber-200/90"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {rcPlatformOnly ? (
        <>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 xl:pb-3">
            Platform operations
          </div>
          <ul className="flex flex-col gap-px px-2">
            {RC_ADMIN_SIDEBAR_NAV.map(({ path, label }) => {
              const href = resolveSideNavHref(path, to);
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={path}>
                  <Link
                    href={href}
                    className={`block rounded-md px-3 py-1.5 text-[13px] font-medium leading-snug transition-colors xl:py-2 ${
                      active
                        ? "bg-slate-800 text-sky-200/90"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      </div>
      {auth && !isLoading && user ? <SidebarSignOutFooter email={user.email} /> : null}
    </nav>
  );
}

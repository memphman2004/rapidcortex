"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Building2,
  Camera,
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  Headphones,
  Image as ImageIcon,
  Layers,
  Link2,
  Lock,
  Shield,
  Upload,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { isRcSuperAdmin } from "rapid-cortex-security";
import type { AgencyTenant } from "rapid-cortex-shared";
import { resolveAgencyVerticalFromTenant } from "rapid-cortex-shared";
import { HelpChrome } from "@/components/help/help-chrome";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { SiteSquareMark } from "@/components/brand/site-logo-link";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  fetchAgencies,
  fetchApiHealth,
  fetchPlatformSummary,
  isApiConfigured,
} from "@/lib/api";
import { buildNavContext } from "@/lib/navigation/nav-context";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { navIconByName } from "@/lib/navigation/nav-icons";
import {
  getRoleNav,
  type NavItem,
  type RoleNav,
} from "@/lib/navigation/role-nav";
import { useNavBadgeCounts } from "@/lib/navigation/use-nav-badge-counts";
import { needsOnboardingAttention } from "@/lib/platform-onboarding-helpers";
import {
  loadConsoleBg,
  rcAdminBgStorageKey,
  removeLocalStorage,
  writeAccountAvatar,
  writeLocalStorage,
} from "@/lib/account/account-picture";
import { C } from "@/lib/theme/rc-theme-tokens";

// ─── Design tokens (theme-aware CSS vars via C) ───────────────────────────────

const FONT =
  "var(--rc-dashboard-font-family, Inter, ui-sans-serif, system-ui, sans-serif)";

const ENV_STORAGE_KEY = "rc-admin-console-env";

const ENVS = [
  {
    id: "production",
    name: "Production",
    abbr: "PROD",
    label: "Production Environment",
    crestBg: "#4c1d95",
    defaultBg:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1920&q=80",
    stats: { agencies: 0, pilots: 0, health: "99.8%", tickets: 0 },
  },
  {
    id: "staging",
    name: "Staging",
    abbr: "STG",
    label: "Staging Environment",
    crestBg: "#1e3a5f",
    defaultBg:
      "https://images.unsplash.com/photo-1570752812640-d68e2b88c07b?auto=format&fit=crop&w=1920&q=80",
    stats: { agencies: 0, pilots: 0, health: "100%", tickets: 0 },
  },
  {
    id: "development",
    name: "Development",
    abbr: "DEV",
    label: "Development Environment",
    crestBg: "#064e3b",
    defaultBg:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80",
    stats: { agencies: 0, pilots: 0, health: "99.2%", tickets: 0 },
  },
] as const;

type EnvId = (typeof ENVS)[number]["id"];
type EnvDef = (typeof ENVS)[number];

const PRESETS = [
  {
    label: "Server Room",
    fallback: "#080c18",
    url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Data Center",
    fallback: "#080812",
    url: "https://images.unsplash.com/photo-1570752812640-d68e2b88c07b?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Tech Abstract",
    fallback: "#050810",
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Network Ops Center",
    fallback: "#060a14",
    url: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "City Infrastructure",
    fallback: "#080810",
    url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Fiber Optic",
    fallback: "#04060e",
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80",
  },
] as const;

const VERTICAL_BADGES = {
  "911": {
    label: "911",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.18)",
    border: "rgba(59,130,246,0.35)",
  },
  campus: {
    label: "CAMPUS",
    color: "#10b981",
    bg: "rgba(16,185,129,0.18)",
    border: "rgba(16,185,129,0.35)",
  },
  venue: {
    label: "VENUE",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.18)",
    border: "rgba(245,158,11,0.35)",
  },
} as const;

type VerticalKey = keyof typeof VERTICAL_BADGES;

const PLAN_BADGES = {
  Enterprise: {
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.3)",
  },
  Pro: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
    border: "rgba(59,130,246,0.3)",
  },
  Standard: {
    color: "#0891b2",
    bg: "rgba(8,145,178,0.15)",
    border: "rgba(8,145,178,0.3)",
  },
  Essential: {
    color: "#64748b",
    bg: "rgba(100,116,139,0.15)",
    border: "rgba(100,116,139,0.3)",
  },
} as const;

type PlanKey = keyof typeof PLAN_BADGES;

const STATUS_BADGES = {
  Active: {
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
  },
  Pilot: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
  },
  Onboarding: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.3)",
  },
  Suspended: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
  },
} as const;

type StatusKey = keyof typeof STATUS_BADGES;

const PLATFORM_HEALTH = [
  { label: "API Gateway", uptime: "99.9%" },
  { label: "WebSocket", uptime: "100%" },
  { label: "AI Transcription", uptime: "99.8%" },
  { label: "Translation", uptime: "99.7%" },
  { label: "CAD Integration", uptime: "99.9%" },
  { label: "SMS / Twilio", uptime: "100%" },
  { label: "Storage (S3)", uptime: "100%" },
  { label: "Database", uptime: "99.99%" },
] as const;

const PLAN_DIST_EMPTY = [
  { plan: "Enterprise" as PlanKey, count: 0, pct: 0, color: "#8b5cf6", rgb: "139,92,246" },
  { plan: "Pro" as PlanKey, count: 0, pct: 0, color: "#3b82f6", rgb: "59,130,246" },
  { plan: "Standard" as PlanKey, count: 0, pct: 0, color: "#0891b2", rgb: "8,145,178" },
  { plan: "Essential" as PlanKey, count: 0, pct: 0, color: "#64748b", rgb: "100,116,139" },
];

const ONBOARDING_PIPELINE_COSMETIC = [
  { stage: "Contract Signed", count: 0, color: "#8b5cf6" },
  { stage: "Provisioning", count: 0, color: "#3b82f6" },
  { stage: "Training", count: 0, color: "#0891b2" },
  { stage: "Go-Live Ready", count: 0, color: "#10b981" },
];

const nColors = {
  error: { dot: C.red, bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.22)" },
  info: { dot: C.blue, bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.22)" },
  warning: { dot: C.amber, bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.22)" },
  success: { dot: C.green, bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.22)" },
} as const;

type NotifType = keyof typeof nColors;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: "10px",
    ...extra,
  };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || "there";
}

function flattenNavItems(nav: RoleNav): NavItem[] {
  return nav.sections.flatMap((s) => s.items);
}

function findNavHref(items: NavItem[], ...ids: string[]): string | undefined {
  for (const id of ids) {
    const match = items.find((i) => i.id === id);
    if (match) return match.href;
  }
  return undefined;
}

function navItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href || pathname === `${item.href}/`;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function formatClock(now: Date): { dateLine: string; timeMain: string; ampm: string } {
  const dateLine = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeParts = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const match = timeParts.match(/^(.+)\s+(AM|PM)$/i);
  return {
    dateLine,
    timeMain: match?.[1] ?? timeParts,
    ampm: match?.[2] ?? "",
  };
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roleLabel(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "rcsuperadmin") return "RC Super Admin";
  if (r === "rcitadmin") return "RC IT Admin";
  if (r === "rcadmin") return "RC Admin";
  return role || "RC Admin";
}

function mapVertical(agency: AgencyTenant): VerticalKey {
  const v = resolveAgencyVerticalFromTenant(agency);
  if (v === "campus") return "campus";
  if (v === "venue") return "venue";
  return "911";
}

function mapPlan(agency: AgencyTenant): PlanKey {
  const raw = (
    agency.monetizationPlanId ??
    agency.planId ??
    agency.planTier ??
    ""
  )
    .toString()
    .toLowerCase();
  if (raw.includes("enterprise")) return "Enterprise";
  if (raw.includes("command") || raw.includes("pro")) return "Pro";
  if (raw.includes("professional") || raw.includes("standard")) return "Standard";
  if (raw.includes("starter") || raw.includes("essential")) return "Essential";
  if (agency.status === "pilot" || agency.type === "pilot" || agency.pilotMode) {
    return "Standard";
  }
  return "Essential";
}

function mapStatus(agency: AgencyTenant): StatusKey {
  if (agency.status === "active") return "Active";
  if (agency.status === "pilot") return "Pilot";
  if (agency.status === "suspended" || agency.status === "archived") return "Suspended";
  return "Onboarding";
}

function parseEnvId(raw: string | null): EnvId {
  if (raw === "staging" || raw === "development" || raw === "production") return raw;
  return "production";
}

function findEnv(id: EnvId): EnvDef {
  return ENVS.find((e) => e.id === id) ?? ENVS[0];
}

// ─── Plan distribution chart ──────────────────────────────────────────────────

function PlanDistChart({
  rows,
  total,
}: {
  rows: { plan: string; count: number; pct: number; color: string; rgb: string }[];
  total: number;
}) {
  return (
    <svg
      viewBox="0 0 240 160"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <rect width="240" height="160" fill="#050812" rx="6" />
      <text
        x="12"
        y="20"
        fill="#3d3460"
        fontSize="9"
        fontWeight="600"
        fontFamily="inherit"
        letterSpacing="0.8"
      >
        {total > 0
          ? `PLAN DISTRIBUTION — ${total} AGENCIES`
          : "PLAN DISTRIBUTION — NO DATA"}
      </text>
      {rows.map((row, i) => {
        const barW = Math.max(row.pct > 0 ? 4 : 0, (row.pct / 100) * 140);
        const y = 32 + i * 30;
        return (
          <g key={row.plan}>
            <text
              x="12"
              y={y + 11}
              fill="#5a4d7a"
              fontSize="9.5"
              fontWeight="600"
              fontFamily="inherit"
            >
              {row.plan}
            </text>
            <rect
              x="82"
              y={y}
              width={barW}
              height="18"
              rx="3"
              fill={`rgba(${row.rgb},0.7)`}
            />
            <text
              x={82 + barW + 6}
              y={y + 12}
              fill={row.color}
              fontSize="10"
              fontWeight="700"
              fontFamily="inherit"
            >
              {row.count}
            </text>
            <text
              x={82 + Math.max(barW, 8) + 26}
              y={y + 12}
              fill="#2d2445"
              fontSize="9"
              fontFamily="inherit"
            >
              {row.pct}%
            </text>
          </g>
        );
      })}
      <line
        x1="82"
        y1="28"
        x2="82"
        y2="148"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
      />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type RcAdminConsoleHomeProps = {
  agencyId?: string;
  /** Cognito / session user id — scopes the welcome banner image per account. */
  userId?: string;
  displayName: string;
  userEmail?: string;
  userRole: string;
};

type ModalTab = "presets" | "url" | "upload";

type QuickActionDef = {
  key: string;
  label: string;
  href: string;
  Icon: LucideIcon;
  bg: string;
  color: string;
  bdr: string;
  emergency?: boolean;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export function RcAdminConsoleHome(props: RcAdminConsoleHomeProps) {
  return (
    <ThemeProvider storageKey="rc-theme-admin">
      <RcAdminConsoleHomeInner {...props} />
    </ThemeProvider>
  );
}

function RcAdminConsoleHomeInner({
  agencyId,
  userId = "",
  displayName,
  userEmail,
  userRole,
}: RcAdminConsoleHomeProps) {
  const pathname = usePathname() ?? "";
  const apiLive = isApiConfigured();
  const superAdmin = isRcSuperAdmin(userRole);
  const roleBadge = roleLabel(userRole);
  const navRole = userRole.trim() || "rcadmin";

  const nav = useMemo(() => {
    const ctx = buildNavContext({ agencyId: agencyId ?? "" }, undefined);
    return filterRoleNavByFeatures(getRoleNav(navRole, ctx));
  }, [agencyId, navRole]);

  const navItems = useMemo(() => flattenNavItems(nav), [nav]);
  const badgeCounts = useNavBadgeCounts(userRole);

  const agenciesQ = useQuery({
    queryKey: ["agencies", "rc-admin-console"],
    queryFn: fetchAgencies,
    enabled: apiLive,
    retry: false,
  });
  const summaryQ = useQuery({
    queryKey: ["platform", "summary", "rc-admin-console"],
    queryFn: fetchPlatformSummary,
    enabled: apiLive,
    retry: false,
  });
  const healthQ = useQuery({
    queryKey: ["api", "health", "rc-admin-console"],
    queryFn: fetchApiHealth,
    enabled: apiLive,
    retry: false,
  });

  const agencies = useMemo(() => agenciesQ.data ?? [], [agenciesQ.data]);
  const loadingAgencies = agenciesQ.isLoading;

  const [now, setNow] = useState(() => new Date());
  const [envId, setEnvId] = useState<EnvId>("production");
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("presets");
  const [urlInput, setUrlInput] = useState("");
  const [envOpen, setEnvOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme, rootRef } = useThemeRoot<HTMLDivElement>();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      setEnvId(parseEnvId(window.localStorage.getItem(ENV_STORAGE_KEY)));
    } catch {
      setEnvId("production");
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setCustomBg(null);
      return;
    }
    setCustomBg(
      loadConsoleBg({
        userId,
        keyed: rcAdminBgStorageKey(userId, envId),
        legacyKey: `rc-admin-bg:${envId}`,
      }),
    );
  }, [envId, userId]);

  const env = findEnv(envId);
  const currentBg = customBg ?? env.defaultBg;
  const hasCustomBg = Boolean(customBg);
  const clock = formatClock(now);

  const switchEnv = useCallback((next: EnvDef) => {
    setEnvId(next.id);
    try {
      window.localStorage.setItem(ENV_STORAGE_KEY, next.id);
    } catch {
      /* ignore */
    }
    setEnvOpen(false);
  }, []);

  const applyBg = useCallback(
    (url: string) => {
      setCustomBg(url);
      if (userId) {
        writeLocalStorage(rcAdminBgStorageKey(userId, envId), url);
        // Uploaded/custom images also become this account's header avatar.
        if (url.startsWith("data:") || url.startsWith("http")) {
          writeAccountAvatar(userId, url);
        }
      }
      setShowModal(false);
      setUrlInput("");
    },
    [envId, userId],
  );

  const resetBg = useCallback(() => {
    setCustomBg(null);
    if (userId) {
      removeLocalStorage(rcAdminBgStorageKey(userId, envId));
    }
    setShowModal(false);
  }, [envId, userId]);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") applyBg(result);
    };
    reader.readAsDataURL(file);
  };

  const liveAgencyCount =
    summaryQ.data?.totals.agencies ?? (agencies.length > 0 ? agencies.length : null);
  const livePilots =
    summaryQ.data?.totals.pilotOrDraftAgencies ??
    (agencies.length > 0
      ? agencies.filter(
          (a) => a.status === "pilot" || a.status === "draft" || a.type === "pilot" || a.pilotMode,
        ).length
      : null);

  const healthOnline =
    !healthQ.data || healthQ.data.status === "ok" || healthQ.data.status === "healthy";
  const healthLabel = healthOnline ? env.stats.health : "Degraded";

  // Prefer live counts; fall back to zeros (demo-safe) — env.stats reserved for cosmetic labels.
  const kpiAgencies = liveAgencyCount ?? env.stats.agencies;
  const kpiPilots = livePilots ?? env.stats.pilots;
  const kpiTickets = 0;
  const usingLiveKpis = liveAgencyCount != null;

  const agenciesHref = findNavHref(navItems, "agencies");
  // Prefer create route when agencies nav exists; otherwise fall back to list.
  const onboardAgencyHref = agenciesHref
    ? agenciesHref.endsWith("/new")
      ? agenciesHref
      : `${agenciesHref.replace(/\/$/, "")}/new`
    : undefined;
  const flagsHref = findNavHref(navItems, "flags");
  const healthHref = findNavHref(navItems, "health");
  const supportHref = findNavHref(navItems, "notices", "support");
  const agreementsHref = findNavHref(navItems, "agreements");
  const usersHref = findNavHref(navItems, "users");
  const grantsHref = findNavHref(navItems, "grants") ?? "/rc-admin/grants";
  const reportsHref = findNavHref(navItems, "reports");
  const auditHref = findNavHref(navItems, "audit");
  const billingHref = findNavHref(navItems, "billing");
  const onboardingHref = findNavHref(navItems, "agencies") ?? "/rc-admin/onboarding";

  const roleLower = userRole.trim().toLowerCase();
  const showEmergency =
    roleLower === "rcitadmin" || roleLower === "rcsuperadmin";

  const quickActions = useMemo(() => {
    const tile = (mix: string) => ({
      bg: `color-mix(in srgb, ${mix} 16%, var(--rc-surface))`,
      color: "var(--rc-text-primary)",
      bdr: "var(--rc-border)",
    });
    const actions: QuickActionDef[] = [];
    if (onboardAgencyHref || agenciesHref) {
      actions.push({
        key: "onboard",
        label: "Onboard Agency",
        href: onboardAgencyHref ?? agenciesHref!,
        Icon: Building2,
        ...tile("var(--rc-green, #10b981)"),
      });
    }
    if (flagsHref) {
      actions.push({
        key: "flags",
        label: "Feature Flags",
        href: flagsHref,
        Icon: GitBranch,
        ...tile("var(--rc-violet, #8b5cf6)"),
      });
    }
    if (healthHref) {
      actions.push({
        key: "health",
        label: "Platform Health",
        href: healthHref,
        Icon: Activity,
        ...tile("var(--rc-blue, #3b82f6)"),
      });
    }
    if (supportHref) {
      actions.push({
        key: "support",
        label: "User Support",
        href: supportHref,
        Icon: Users,
        ...tile("var(--rc-sky, #38bdf8)"),
      });
    }
    if (agreementsHref) {
      actions.push({
        key: "agreements",
        label: "Adobe Sign",
        href: agreementsHref,
        Icon: FileText,
        ...tile("var(--rc-amber, #f59e0b)"),
      });
    }
    if (showEmergency && usersHref) {
      actions.push({
        key: "emergency",
        label: "Emergency Deactivate",
        href: usersHref,
        Icon: Zap,
        ...tile("var(--rc-red, #ef4444)"),
        emergency: true,
      });
    }
    return actions;
  }, [
    agenciesHref,
    onboardAgencyHref,
    flagsHref,
    healthHref,
    supportHref,
    agreementsHref,
    showEmergency,
    usersHref,
  ]);

  const recentAgencies = useMemo(() => {
    return [...agencies]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .slice(0, 5);
  }, [agencies]);

  const planDist = useMemo(() => {
    if (agencies.length === 0) return { rows: PLAN_DIST_EMPTY, total: 0 };
    const counts: Record<PlanKey, number> = {
      Enterprise: 0,
      Pro: 0,
      Standard: 0,
      Essential: 0,
    };
    for (const a of agencies) {
      counts[mapPlan(a)] += 1;
    }
    const total = agencies.length;
    const rows = PLAN_DIST_EMPTY.map((row) => ({
      ...row,
      count: counts[row.plan],
      pct: total > 0 ? Math.round((counts[row.plan] / total) * 100) : 0,
    }));
    return { rows, total };
  }, [agencies]);

  const onboardingPipeline = useMemo(() => {
    if (agencies.length === 0) return ONBOARDING_PIPELINE_COSMETIC;
    let contract = 0;
    let provisioning = 0;
    let training = 0;
    let goLive = 0;
    for (const a of agencies) {
      const steps = a.config?.platformOnboarding?.steps;
      if (a.status === "draft" || !steps) {
        contract += 1;
        continue;
      }
      const trainingStatus = steps.training;
      const goLiveStatus = steps.go_live;
      if (goLiveStatus === "complete" || a.status === "active") {
        goLive += 1;
      } else if (trainingStatus === "in_progress" || trainingStatus === "complete") {
        training += 1;
      } else if (needsOnboardingAttention(a.status, steps)) {
        provisioning += 1;
      } else {
        contract += 1;
      }
    }
    return [
      { stage: "Contract Signed", count: contract, color: "#8b5cf6" },
      { stage: "Provisioning", count: provisioning, color: "#3b82f6" },
      { stage: "Training", count: training, color: "#0891b2" },
      { stage: "Go-Live Ready", count: goLive, color: "#10b981" },
    ];
  }, [agencies]);

  const onboardingActive = onboardingPipeline.reduce((s, r) => s + r.count, 0);
  const onboardingMax = Math.max(1, ...onboardingPipeline.map((r) => r.count));

  const notifications = useMemo(() => {
    // Prefer real signals from recent agency lifecycle; empty when none.
    return recentAgencies.slice(0, 5).map((a) => {
      const status = mapStatus(a);
      const type: NotifType =
        status === "Suspended" ? "warning" : status === "Active" ? "success" : "info";
      return {
        id: a.agencyId,
        type,
        title:
          status === "Pilot"
            ? "Pilot agency"
            : status === "Onboarding"
              ? "Onboarding in progress"
              : status === "Suspended"
                ? "Agency suspended"
                : "Agency active",
        desc: a.name,
        time: formatTimeAgo(a.updatedAt || a.createdAt),
        href: agenciesHref ? `${agenciesHref}/${encodeURIComponent(a.agencyId)}` : agenciesHref,
      };
    });
  }, [recentAgencies, agenciesHref]);

  const badgeForItem = (item: NavItem): number | null => {
    if (!item.badge || item.badge.type !== "count") return null;
    const n = badgeCounts[item.badge.key] ?? 0;
    return n > 0 ? n : null;
  };

  const kpiCards: {
    label: string;
    value: string | number;
    color: string;
    icon: ReactNode;
    iconBg: string;
    linkLabel: string;
    href?: string;
  }[] = [
    {
      label: "TOTAL AGENCIES",
      value: loadingAgencies && liveAgencyCount == null ? "…" : kpiAgencies,
      color: C.text,
      icon: <Building2 size={17} color={C.purple} strokeWidth={1.7} />,
      iconBg: "rgba(139,92,246,0.15)",
      linkLabel: "View all agencies",
      href: agenciesHref,
    },
    {
      label: "ACTIVE PILOTS",
      value: loadingAgencies && livePilots == null ? "…" : kpiPilots,
      color: C.amber,
      icon: <Layers size={17} color={C.amber} strokeWidth={1.7} />,
      iconBg: "rgba(245,158,11,0.15)",
      linkLabel: "View pilot pipeline",
      href: agenciesHref,
    },
    {
      label: "PLATFORM HEALTH",
      value: healthQ.isLoading ? "…" : healthLabel,
      color: healthOnline ? C.green : C.amber,
      icon: <Activity size={17} color={healthOnline ? C.green : C.amber} strokeWidth={1.7} />,
      iconBg: healthOnline ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
      linkLabel: "View health status",
      href: healthHref,
    },
    {
      label: "OPEN TICKETS",
      value: kpiTickets,
      color: C.text,
      icon: <AlertTriangle size={17} color={C.textSub} strokeWidth={1.7} />,
      iconBg: "rgba(100,116,139,0.15)",
      linkLabel: "View support tickets",
      href: supportHref,
    },
  ];

  return (
    <HelpChrome role={userRole}>
      <div
        ref={rootRef}
        data-theme={theme}
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: C.bg,
          fontFamily: FONT,
          color: C.text,
          colorScheme: theme,
          fontSize: "14px",
          position: "relative",
        }}
        onClick={() => envOpen && setEnvOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && envOpen) setEnvOpen(false);
        }}
        role="presentation"
      >
        {/* Left sidebar */}
        <aside
          style={{
            width: 208,
            minWidth: 208,
            background: C.surface,
            display: "flex",
            flexDirection: "column",
            borderRight: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ padding: "18px 14px 14px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <SiteSquareMark size={34} priority />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--rc-text-primary)",
                    letterSpacing: "0.5px",
                    lineHeight: 1,
                  }}
                >
                  RAPID <span style={{ color: C.purple }}>CORTEX</span>
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: C.purple,
                    letterSpacing: "2.5px",
                    marginTop: 2,
                  }}
                >
                  {nav.roleBadge}
                </div>
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, padding: 7, overflowY: "auto" }} aria-label="RC Admin navigation">
            {nav.sections.map((section, sectionIndex) => (
              <div key={section.id}>
                {section.label ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: sectionIndex === 0 ? "6px 9px 4px" : "12px 9px 4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "1.6px",
                        textTransform: "uppercase",
                        color: C.purple,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {section.label}
                    </span>
                    <div
                      style={{
                        height: 1,
                        flex: 1,
                        background: C.border,
                      }}
                      aria-hidden
                    />
                  </div>
                ) : null}
                {section.items.map((item) => {
              const Icon = navIconByName(item.icon);
              const active = navItemActive(pathname, item);
              const count = badgeForItem(item);
              const content = (
                <>
                  <Icon size={15} color={active ? C.purple : C.textSub} strokeWidth={1.7} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 400,
                      color: active ? C.text : "#5a4d7a",
                    }}
                  >
                    {item.label}
                  </span>
                  {item.badge?.type === "label" ? (
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        color: C.textMuted,
                        letterSpacing: "0.4px",
                      }}
                    >
                      {item.badge.text}
                    </span>
                  ) : null}
                  {count != null ? (
                    <span
                      style={{
                        background: C.red,
                        color: "#fff",
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: 999,
                      }}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </>
              );
              const rowStyle: CSSProperties = {
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "7px 9px",
                borderRadius: 6,
                cursor: "pointer",
                background: active ? "rgba(139,92,246,0.13)" : "transparent",
                borderLeft: active ? `2px solid ${C.purple}` : "2px solid transparent",
                marginBottom: 1,
                textDecoration: "none",
                color: "inherit",
              };
              if (item.external) {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    style={rowStyle}
                  >
                    {content}
                  </a>
                );
              }
              return (
                <Link key={item.id} href={item.href} style={rowStyle}>
                  {content}
                </Link>
              );
                })}
              </div>
            ))}
          </nav>

          {/* Environment switcher + user */}
          <div style={{ borderTop: `1px solid ${C.border}`, position: "relative" }}>
            {envOpen ? (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 0,
                  right: 0,
                  background: C.surface,
                  border: `1px solid ${C.borderHard}`,
                  borderRadius: "8px 8px 0 0",
                  overflow: "hidden",
                  zIndex: 200,
                }}
                role="listbox"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.textSub,
                      letterSpacing: "1px",
                    }}
                  >
                    SWITCH ENVIRONMENT
                  </span>
                  <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                    UI preview only — does not change AWS
                  </div>
                </div>
                {ENVS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => switchEnv(e)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: e.id === env.id ? "rgba(139,92,246,0.1)" : "transparent",
                      border: "none",
                      borderLeft: `2px solid ${e.id === env.id ? C.purple : "transparent"}`,
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 5,
                        background: e.crestBg,
                        border: `1px solid ${C.borderHard}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {e.abbr}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{e.name}</div>
                      <div style={{ fontSize: 10, color: C.textSub }}>{e.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEnvOpen((v) => !v);
              }}
              style={{
                width: "100%",
                padding: "11px 14px",
                display: "flex",
                alignItems: "center",
                gap: 9,
                cursor: "pointer",
                borderBottom: `1px solid ${C.border}`,
                background: "transparent",
                border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: 1,
                borderBottomColor: C.border,
                fontFamily: "inherit",
                textAlign: "left",
              }}
              aria-haspopup="listbox"
              aria-expanded={envOpen}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: env.crestBg,
                  border: `2px solid ${C.borderHard}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {env.abbr}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {env.name}
                </div>
                <div style={{ fontSize: 10, color: C.textSub }}>{env.label}</div>
              </div>
              <ChevronDown size={13} color={C.textSub} style={{ flexShrink: 0 }} />
            </button>

            <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: customBg
                    ? `center / cover no-repeat url(${JSON.stringify(customBg)})`
                    : "linear-gradient(135deg,#6d28d9,#4c1d95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
                aria-hidden={Boolean(customBg)}
              >
                {customBg ? null : initialsFromName(displayName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayName}
                </div>
                <div style={{ fontSize: 10, color: C.purple }}>{roleBadge}</div>
              </div>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: C.green,
                  flexShrink: 0,
                }}
              />
            </div>
          </div>
        </aside>

        {/* Main + right */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <header
              style={{
                background: C.surface,
                borderBottom: `1px solid ${C.border}`,
                padding: "0 18px",
                minHeight: 54,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexShrink: 0,
                flexWrap: "wrap",
                paddingTop: 6,
                paddingBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 7,
                    background: env.crestBg,
                    border: `2px solid ${C.borderHard}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {env.abbr}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                    Rapid Cortex Platform
                  </div>
                  <div style={{ fontSize: 10.5, color: C.textSub }}>
                    RC Admin Console · {env.name}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    background: superAdmin
                      ? "rgba(139,92,246,0.18)"
                      : "rgba(59,130,246,0.12)",
                    border: `1px solid ${
                      superAdmin ? "rgba(139,92,246,0.4)" : "rgba(59,130,246,0.3)"
                    }`,
                    borderRadius: 6,
                  }}
                >
                  {superAdmin ? (
                    <Lock size={11} color={C.purple} strokeWidth={2} />
                  ) : (
                    <Shield size={11} color={C.blue} strokeWidth={2} />
                  )}
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: superAdmin ? C.purple : C.blue,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {roleBadge}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, color: C.textSub }}>{clock.dateLine}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1 }}>
                    {clock.timeMain}{" "}
                    <span style={{ fontSize: 12, fontWeight: 400 }}>{clock.ampm}</span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 12px",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: healthOnline ? C.green : C.amber,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                      Rapid Cortex Network
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: healthOnline ? C.green : C.amber,
                      }}
                    >
                      {healthOnline ? "All Systems Operational" : "Health check degraded"}
                    </div>
                  </div>
                </div>
                <CampusDashboardHeaderUtilities
                  email={userEmail}
                  role={userRole}
                  agencyId={agencyId}
                  userId={userId}
                  leadingSlot={<ThemeToggle variant="tailwind" />}
                />
              </div>
            </header>

            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              {/* Hero */}
              <div style={{ position: "relative", height: 330, overflow: "hidden", flexShrink: 0 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${currentBg})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    transition: "background-image 0.5s ease",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg,rgba(7,7,15,0.82) 0%,rgba(7,7,15,0.45) 55%,rgba(7,7,15,0.2) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg,rgba(7,7,15,0.2) 0%,rgba(7,7,15,0.05) 30%,rgba(7,7,15,0.75) 73%,rgba(7,7,15,1) 100%)",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "22px 18px 16px",
                  }}
                >
                  <div>
                    <h1
                      style={{
                        margin: 0,
                        fontSize: 24,
                        fontWeight: 800,
                        color: "#fff",
                        textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                      }}
                    >
                      Welcome back, {firstName(displayName)}.
                    </h1>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.78)",
                        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                      }}
                    >
                      Rapid Cortex Platform — {env.name} overview.
                      {!usingLiveKpis && !loadingAgencies ? (
                        <span style={{ color: "rgba(255,255,255,0.45)" }}>
                          {" "}
                          · Agency metrics load when API is available
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4,1fr)",
                      gap: 10,
                    }}
                  >
                    {kpiCards.map((s) => (
                      <div
                        key={s.label}
                        style={{
                          background: "rgba(7,7,15,0.91)",
                          backdropFilter: "blur(12px)",
                          border: `1px solid ${C.borderHard}`,
                          borderRadius: 9,
                          padding: "12px 13px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                color: C.textSub,
                                letterSpacing: "0.7px",
                              }}
                            >
                              {s.label}
                            </div>
                            <div
                              style={{
                                fontSize: 26,
                                fontWeight: 800,
                                color: s.color,
                                lineHeight: 1.2,
                                marginTop: 3,
                              }}
                            >
                              {s.value}
                            </div>
                          </div>
                          <div
                            style={{
                              width: 35,
                              height: 35,
                              borderRadius: 7,
                              background: s.iconBg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {s.icon}
                          </div>
                        </div>
                        {s.href ? (
                          <Link
                            href={s.href}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              marginTop: 8,
                              fontSize: 10.5,
                              color: C.purple,
                              fontWeight: 500,
                              textDecoration: "none",
                            }}
                          >
                            {s.linkLabel} <ChevronRight size={11} />
                          </Link>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              marginTop: 8,
                              fontSize: 10.5,
                              color: C.textMuted,
                              fontWeight: 500,
                            }}
                          >
                            {s.linkLabel}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 11px",
                    background: "rgba(0,0,0,0.6)",
                    border: `1px solid ${C.borderHard}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    color: C.text,
                    fontSize: 11.5,
                    fontWeight: 500,
                    backdropFilter: "blur(8px)",
                    fontFamily: "inherit",
                  }}
                >
                  <Camera size={13} color={C.text} strokeWidth={1.7} />
                  Change My Image
                  {hasCustomBg ? (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: C.green,
                        marginLeft: 2,
                      }}
                    />
                  ) : null}
                </button>
              </div>

              {/* Three panels */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                  padding: "34px 16px 12px",
                }}
              >
                {/* Recent Agency Activity */}
                <div style={card()}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "13px 15px 9px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.textSub,
                        letterSpacing: "0.7px",
                      }}
                    >
                      RECENT AGENCY ACTIVITY
                    </span>
                    {agenciesHref ? (
                      <Link
                        href={agenciesHref}
                        style={{
                          fontSize: 11,
                          color: C.purple,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        View all
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ padding: "0 8px 8px", minHeight: 120 }}>
                    {loadingAgencies && recentAgencies.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>
                        Loading agencies…
                      </div>
                    ) : recentAgencies.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>
                        No agencies yet. Onboard a tenant to see activity here.
                      </div>
                    ) : (
                      recentAgencies.map((a) => {
                        const vb = VERTICAL_BADGES[mapVertical(a)];
                        const plan = mapPlan(a);
                        const pb = PLAN_BADGES[plan];
                        const status = mapStatus(a);
                        const sb = STATUS_BADGES[status];
                        return (
                          <div
                            key={a.agencyId}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 8px",
                              borderRadius: 7,
                              marginBottom: 4,
                              background: "rgba(255,255,255,0.02)",
                              borderLeft: `2px solid ${vb.color}`,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: C.text,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {a.name}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  marginTop: 3,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    background: vb.bg,
                                    color: vb.color,
                                    border: `1px solid ${vb.border}`,
                                  }}
                                >
                                  {vb.label}
                                </span>
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 600,
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    background: pb.bg,
                                    color: pb.color,
                                    border: `1px solid ${pb.border}`,
                                  }}
                                >
                                  {plan}
                                </span>
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                gap: 3,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: sb.bg,
                                  color: sb.color,
                                  border: `1px solid ${sb.border}`,
                                }}
                              >
                                {status}
                              </span>
                              <span style={{ fontSize: 9.5, color: C.textSub }}>
                                {formatTimeAgo(a.updatedAt || a.createdAt)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {agenciesHref ? (
                    <Link
                      href={agenciesHref}
                      style={{
                        padding: "9px 15px",
                        borderTop: `1px solid ${C.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: C.textSub,
                        gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      View all agencies <ArrowRight size={12} strokeWidth={1.7} />
                    </Link>
                  ) : null}
                </div>

                {/* Platform Health */}
                <div style={card()}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "13px 15px 9px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.textSub,
                        letterSpacing: "0.7px",
                      }}
                    >
                      PLATFORM HEALTH
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: C.green,
                        }}
                      />
                      <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>
                        All Online
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: "0 8px 8px" }}>
                    {PLATFORM_HEALTH.map((svc) => (
                      <div
                        key={svc.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 8px",
                          borderRadius: 6,
                          marginBottom: 3,
                          background: "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: C.green,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: C.text }}>
                          {svc.label}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.green }}>
                            {svc.uptime}
                          </span>
                          <div
                            style={{
                              height: 3,
                              width: 40,
                              background: "rgba(255,255,255,0.06)",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${parseFloat(svc.uptime)}%`,
                                background: "rgba(16,185,129,0.7)",
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {healthHref ? (
                    <Link
                      href={healthHref}
                      style={{
                        padding: "9px 15px",
                        borderTop: `1px solid ${C.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: C.textSub,
                        gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      Full status page <ArrowRight size={12} strokeWidth={1.7} />
                    </Link>
                  ) : null}
                </div>

                {/* Plan Distribution */}
                <div style={card()}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "13px 15px 9px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.textSub,
                        letterSpacing: "0.7px",
                      }}
                    >
                      PLAN DISTRIBUTION
                    </span>
                    {billingHref ? (
                      <Link
                        href={billingHref}
                        style={{
                          fontSize: 11,
                          color: C.purple,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        Billing
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ padding: "4px 10px 12px" }}>
                    <PlanDistChart rows={planDist.rows} total={planDist.total} />
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ padding: "4px 16px 20px" }}>
                {quickActions.length > 0 ? (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: C.textSub,
                          letterSpacing: "0.7px",
                        }}
                      >
                        QUICK ACTIONS
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${Math.min(quickActions.length, 6)},1fr)`,
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      {quickActions.map((a) => {
                        const Icon = a.Icon;
                        return (
                          <Link
                            key={a.key}
                            href={a.href}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              padding: "14px 8px 11px",
                              background: a.bg,
                              border: `1px solid ${a.bdr}`,
                              borderRadius: 9,
                              cursor: "pointer",
                              gap: 8,
                              textDecoration: "none",
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            {a.emergency ? (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  background:
                                    "repeating-linear-gradient(45deg,rgba(239,68,68,0.04) 0px,rgba(239,68,68,0.04) 4px,transparent 4px,transparent 12px)",
                                }}
                              />
                            ) : null}
                            <Icon
                              size={a.emergency ? 20 : 19}
                              color={a.color}
                              strokeWidth={a.emergency ? 2 : 1.7}
                              style={{ position: "relative" }}
                            />
                            <span
                              style={{
                                fontSize: a.emergency ? 11 : 10.5,
                                fontWeight: a.emergency ? 700 : 600,
                                color: a.color,
                                textAlign: "center",
                                lineHeight: 1.3,
                                position: "relative",
                              }}
                            >
                              {a.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {(
                    [
                      {
                        key: "reports",
                        Icon: BarChart2,
                        label: "REPORTS",
                        desc: "Call volume, billing trends, and agency-level usage analytics.",
                        link: "View Reports",
                        color: C.purple,
                        rgb: "139,92,246",
                        href: reportsHref,
                      },
                      {
                        key: "audit",
                        Icon: Shield,
                        label: "AUDIT LOG",
                        desc: "Full audit trail — all platform actions, grants, and config changes.",
                        link: "Open Audit Log",
                        color: C.blue,
                        rgb: "59,130,246",
                        href: auditHref,
                      },
                      {
                        key: "support",
                        Icon: Headphones,
                        label: "SUPPORT",
                        desc: "Escalation pathways, runbooks, and SLA monitoring for all agencies.",
                        link: "View Support",
                        color: C.cyan,
                        rgb: "6,182,212",
                        href: supportHref,
                      },
                    ] as const
                  ).map((u) => {
                    const Icon = u.Icon;
                    const inner = (
                      <>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 7,
                            background: `rgba(${u.rgb},0.14)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={17} color={u.color} strokeWidth={1.7} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.textSub,
                              letterSpacing: "0.7px",
                              marginBottom: 3,
                            }}
                          >
                            {u.label}
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>
                            {u.desc}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              marginTop: 7,
                              fontSize: 11,
                              color: u.color,
                              fontWeight: 500,
                            }}
                          >
                            {u.link} <ArrowRight size={11} strokeWidth={1.7} />
                          </div>
                        </div>
                      </>
                    );
                    if (!u.href) {
                      return (
                        <div
                          key={u.key}
                          style={card({
                            padding: "13px 15px",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 11,
                            opacity: 0.55,
                          })}
                        >
                          {inner}
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={u.key}
                        href={u.href}
                        style={card({
                          padding: "13px 15px",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 11,
                          textDecoration: "none",
                          color: "inherit",
                        })}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <aside
            style={{
              width: 252,
              minWidth: 252,
              background: C.surface,
              borderLeft: `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "15px 15px 11px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.textSub,
                  letterSpacing: "0.7px",
                }}
              >
                NOTIFICATIONS
              </span>
              {supportHref || agenciesHref ? (
                <Link
                  href={supportHref ?? agenciesHref!}
                  style={{
                    fontSize: 11,
                    color: C.purple,
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  View all
                </Link>
              ) : null}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "12px 9px", fontSize: 12, color: C.textMuted }}>
                  No platform notifications.
                </div>
              ) : (
                notifications.map((n) => {
                  const nc = nColors[n.type];
                  const body = (
                    <>
                      <div style={{ paddingTop: 4, flexShrink: 0 }}>
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: nc.dot,
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 4,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>
                            {n.time}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>{n.desc}</div>
                      </div>
                    </>
                  );
                  const style: CSSProperties = {
                    display: "flex",
                    gap: 9,
                    padding: "8px 9px",
                    borderRadius: 7,
                    background: nc.bg,
                    border: `1px solid ${nc.border}`,
                    marginBottom: 6,
                    textDecoration: "none",
                    color: "inherit",
                  };
                  return n.href ? (
                    <Link key={n.id} href={n.href} style={style}>
                      {body}
                    </Link>
                  ) : (
                    <div key={n.id} style={style}>
                      {body}
                    </div>
                  );
                })
              )}

              {superAdmin ? (
                <div style={card({ padding: "13px 13px", marginTop: 12 })}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.textSub,
                        letterSpacing: "0.7px",
                      }}
                    >
                      ACTIVE GRANTS
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.purple }}>
                      Super Admin Only
                    </span>
                  </div>
                  <div
                    style={{
                      padding: "12px 10px",
                      borderRadius: 7,
                      background: "rgba(139,92,246,0.08)",
                      border: "1px solid rgba(139,92,246,0.2)",
                      marginBottom: 6,
                      fontSize: 11.5,
                      color: C.textSub,
                      lineHeight: 1.45,
                    }}
                  >
                    No active permission overrides. Grants management is roadmap-gated —
                    review policy and tooling on the Grants page.
                  </div>
                  <Link
                    href={grantsHref}
                    style={{
                      marginTop: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "7px",
                      borderRadius: 6,
                      background: "rgba(139,92,246,0.1)",
                      border: "1px solid rgba(139,92,246,0.2)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.purple,
                      gap: 4,
                      textDecoration: "none",
                    }}
                  >
                    Manage All Grants <ArrowRight size={12} strokeWidth={1.7} />
                  </Link>
                </div>
              ) : null}

              <div style={card({ padding: "13px 13px", marginTop: 10 })}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.textSub,
                      letterSpacing: "0.7px",
                    }}
                  >
                    ONBOARDING PIPELINE
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amber }}>
                    {onboardingActive} Active
                  </span>
                </div>
                {onboardingPipeline.map((stage) => (
                  <div key={stage.stage} style={{ marginBottom: 9 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontSize: 11, color: C.textSub }}>{stage.stage}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: stage.color }}>
                        {stage.count} agencies
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 2,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(stage.count / onboardingMax) * 100}%`,
                          background: stage.color,
                          opacity: 0.7,
                          borderRadius: 2,
                          minWidth: stage.count > 0 ? 4 : 0,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {onboardingHref ? (
                  <Link
                    href={onboardingHref}
                    style={{
                      marginTop: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "7px",
                      borderRadius: 6,
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.amber,
                      gap: 4,
                      textDecoration: "none",
                    }}
                  >
                    View Onboarding Board <ArrowRight size={12} strokeWidth={1.7} />
                  </Link>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        {/* Background modal */}
        {showModal ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowModal(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowModal(false);
            }}
            role="presentation"
          >
            <div
              style={{
                width: 560,
                maxHeight: "82vh",
                background: C.surface,
                border: `1px solid ${C.borderHard}`,
                borderRadius: 14,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Change platform background"
            >
              <div
                style={{
                  padding: "17px 20px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                    Change My Image
                  </div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
                    {env.name} environment — stored locally for this browser
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: C.textSub,
                    padding: 4,
                    display: "flex",
                  }}
                >
                  <X size={18} strokeWidth={1.7} />
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  borderBottom: `1px solid ${C.border}`,
                  padding: "0 20px",
                }}
              >
                {(
                  [
                    { id: "presets" as const, label: "Presets", Icon: ImageIcon },
                    { id: "url" as const, label: "Image URL", Icon: Link2 },
                    { id: "upload" as const, label: "Upload", Icon: Upload },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setModalTab(tab.id)}
                    style={{
                      padding: "9px 15px",
                      background: "none",
                      border: "none",
                      borderBottom: `2px solid ${modalTab === tab.id ? C.purple : "transparent"}`,
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: modalTab === tab.id ? 600 : 400,
                      color: modalTab === tab.id ? C.purple : C.textSub,
                      marginBottom: -1,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontFamily: "inherit",
                    }}
                  >
                    <tab.Icon size={13} strokeWidth={1.7} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
                {modalTab === "presets" ? (
                  <>
                    <p style={{ fontSize: 12, color: C.textSub, margin: "0 0 14px" }}>
                      Select a preset background representing the platform or infrastructure.
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3,1fr)",
                        gap: 10,
                      }}
                    >
                      {PRESETS.map((p) => {
                        const isActive = currentBg === p.url;
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => applyBg(p.url)}
                            style={{
                              borderRadius: 8,
                              overflow: "hidden",
                              cursor: "pointer",
                              border: `2px solid ${isActive ? C.purple : C.border}`,
                              transition: "border-color 0.15s",
                              padding: 0,
                              background: "transparent",
                              textAlign: "left",
                              fontFamily: "inherit",
                            }}
                          >
                            <div
                              style={{
                                height: 70,
                                background: p.fallback,
                                backgroundImage: `url(${p.url})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }}
                            />
                            <div
                              style={{
                                padding: "6px 10px",
                                background: "rgba(255,255,255,0.04)",
                                fontSize: 11,
                                fontWeight: 500,
                                color: C.textSub,
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              {isActive ? (
                                <div
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: C.purple,
                                  }}
                                />
                              ) : null}
                              {p.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {modalTab === "url" ? (
                  <>
                    <p style={{ fontSize: 12, color: C.textSub, margin: "0 0 16px" }}>
                      Paste a direct image URL for this environment&apos;s background.
                    </p>
                    <div style={{ display: "flex", gap: 9 }}>
                      <input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/infrastructure.jpg"
                        style={{
                          flex: 1,
                          padding: "9px 12px",
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${C.borderHard}`,
                          borderRadius: 7,
                          color: C.text,
                          fontSize: 12.5,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && urlInput.trim()) applyBg(urlInput.trim());
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => urlInput.trim() && applyBg(urlInput.trim())}
                        style={{
                          padding: "9px 16px",
                          background: "#6d28d9",
                          border: "none",
                          borderRadius: 7,
                          cursor: "pointer",
                          color: "#fff",
                          fontSize: 12.5,
                          fontWeight: 600,
                          fontFamily: "inherit",
                        }}
                      >
                        Apply
                      </button>
                    </div>
                    {urlInput ? (
                      <div
                        style={{
                          marginTop: 14,
                          height: 120,
                          borderRadius: 8,
                          background: `url(${urlInput}) center/cover no-repeat, #07070f`,
                          border: `1px solid ${C.border}`,
                        }}
                      />
                    ) : null}
                  </>
                ) : null}

                {modalTab === "upload" ? (
                  <>
                    <p style={{ fontSize: 12, color: C.textSub, margin: "0 0 16px" }}>
                      Upload a background image for this platform environment.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: "2px dashed rgba(139,92,246,0.3)",
                        borderRadius: 10,
                        padding: "38px 20px",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "rgba(139,92,246,0.04)",
                        width: "100%",
                        fontFamily: "inherit",
                        color: "inherit",
                      }}
                    >
                      <Upload
                        size={26}
                        color={C.purple}
                        strokeWidth={1.7}
                        style={{ marginBottom: 10 }}
                      />
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                        Click to upload an image
                      </div>
                      <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                        PNG, JPG, WEBP · up to 10 MB
                      </div>
                    </button>
                  </>
                ) : null}
              </div>

              <div
                style={{
                  padding: "13px 20px",
                  borderTop: `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <button
                  type="button"
                  onClick={resetBg}
                  style={{
                    padding: "7px 14px",
                    background: "transparent",
                    border: `1px solid ${C.borderHard}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    color: C.textSub,
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  {hasCustomBg ? "Reset to Default" : "No custom image set"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "7px 14px",
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    color: C.textSub,
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>
    </HelpChrome>
  );
}

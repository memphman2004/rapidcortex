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
  ArrowRight,
  BarChart2,
  Camera,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Eye,
  Headphones,
  Image as ImageIcon,
  Link2,
  MapPin,
  Mic,
  PhoneCall,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Incident, UrgencyLevel } from "rapid-cortex-shared";
import { HelpChrome } from "@/components/help/help-chrome";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import { psapIncidentsToMap } from "@/components/maps/map-incident-adapters";
import {
  fetchSupervisorActiveCalls,
  fetchSupervisorOperators,
  isApiConfigured,
  type SupervisorOperatorPresence,
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
import { loadIncidents } from "@/lib/queries";
import {
  consoleBgStorageKey,
  loadConsoleBg,
  removeLocalStorage,
  writeAccountAvatar,
  writeLocalStorage,
} from "@/lib/account/account-picture";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "var(--rc-bg)",
  surface: "var(--rc-surface)",
  card: "rgba(255,255,255,0.033)",
  border: "rgba(255,255,255,0.07)",
  borderHard: "rgba(255,255,255,0.12)",
  text: "var(--rc-text-primary)",
  textSub: "var(--rc-text-secondary)",
  textMuted: "var(--rc-text-muted)",
  blue: "var(--rc-blue)",
  red: "var(--rc-red)",
  green: "var(--rc-green)",
  amber: "var(--rc-amber)",
  purple: "var(--rc-violet)",
} as const;

const FONT =
  "var(--rc-dashboard-font-family, Inter, ui-sans-serif, system-ui, sans-serif)";

const CREST_BG = "#1e3a5f";

const DEFAULT_PSAP_BG =
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=80";

const PRESETS = [
  {
    label: "City Skyline",
    fallback: "#0a0f1e",
    url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Urban Aerial",
    fallback: "#0a1520",
    url: "https://images.unsplash.com/photo-1444628838545-ac4016a5418a?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "City at Night",
    fallback: "#050a15",
    url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Waterfront City",
    fallback: "#0a1525",
    url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Highway Interchange",
    fallback: "#0a0c12",
    url: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Operations Center",
    fallback: "#080c18",
    url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1920&q=80",
  },
] as const;

const CAD_PHASES = [
  {
    phase: 0,
    label: "CAD Standalone",
    short: "Standalone",
    color: "#64748b",
    bg: "rgba(100,116,139,0.15)",
    border: "rgba(100,116,139,0.3)",
  },
  {
    phase: 1,
    label: "CAD Phase 1",
    short: "Phase 1",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.3)",
  },
  {
    phase: 2,
    label: "CAD Phase 2",
    short: "Phase 2",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
    border: "rgba(59,130,246,0.3)",
  },
  {
    phase: 3,
    label: "CAD Phase 3",
    short: "Full Sync",
    color: "#10b981",
    bg: "rgba(16,185,129,0.15)",
    border: "rgba(16,185,129,0.3)",
  },
] as const;

const CALL_TYPES = {
  LAW: { label: "LAW", color: "#3b82f6", bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.35)" },
  FIRE: { label: "FIRE", color: "#ef4444", bg: "rgba(239,68,68,0.18)", border: "rgba(239,68,68,0.35)" },
  EMS: { label: "EMS", color: "#f43f5e", bg: "rgba(244,63,94,0.18)", border: "rgba(244,63,94,0.35)" },
  TRAFFIC: {
    label: "TRAFFIC",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.18)",
    border: "rgba(245,158,11,0.35)",
  },
  OTHER: {
    label: "OTHER",
    color: "#64748b",
    bg: "rgba(100,116,139,0.18)",
    border: "rgba(100,116,139,0.35)",
  },
} as const;

type CallTypeKey = keyof typeof CALL_TYPES;

const PRIORITY = {
  P1: { label: "P1", color: "#ef4444", bg: "rgba(239,68,68,0.2)", border: "rgba(239,68,68,0.4)" },
  P2: { label: "P2", color: "#f97316", bg: "rgba(249,115,22,0.2)", border: "rgba(249,115,22,0.4)" },
  P3: { label: "P3", color: "#3b82f6", bg: "rgba(59,130,246,0.2)", border: "rgba(59,130,246,0.4)" },
} as const;

type PriorityKey = keyof typeof PRIORITY;

const STATUS_STYLE = {
  oncall: {
    label: "On Call",
    color: C.amber,
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
  },
  available: {
    label: "Available",
    color: C.green,
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
  },
  acw: {
    label: "After Call",
    color: C.blue,
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.3)",
  },
  break: {
    label: "Offline",
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
    border: "rgba(100,116,139,0.25)",
  },
} as const;

const AVATAR_COLORS = ["#1d4ed8", "#b91c1c", "#b45309", "#15803d", "#1e40af", "#6b7280"];

const nColors = {
  error: { dot: C.red, bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.22)" },
  info: { dot: C.blue, bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.22)" },
  warning: { dot: C.amber, bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.22)" },
  success: { dot: C.green, bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.22)" },
} as const;

type NotifType = keyof typeof nColors;

const MOCK_CALL_VOLUME = [
  { hour: "6A", calls: 12 },
  { hour: "7A", calls: 18 },
  { hour: "8A", calls: 24 },
  { hour: "9A", calls: 31 },
  { hour: "10A", calls: 28 },
  { hour: "11A", calls: 22 },
  { hour: "12P", calls: 19 },
  { hour: "1P", calls: 16 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: "10px",
    ...extra,
  };
}

function psapBgLegacyKey(agencyId: string): string {
  return `rc-psap-bg:${agencyId}`;
}

function cadPhaseStorageKey(agencyId: string): string {
  return `rc-psap-cad-phase:${agencyId}`;
}

function agencyAbbr(agencyName: string, jurisdiction: string): string {
  const words = agencyName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 5);
  }
  const cleaned = (agencyName || jurisdiction).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length <= 4) return cleaned || "911";
  return cleaned.slice(0, 4);
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

function canEditCadPhase(role?: string): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return r === "supervisor" || r === "agencyadmin" || r === "commsupervisor";
}

function mapCallType(category: Incident["category"]): CallTypeKey {
  switch (category) {
    case "police":
    case "domestic_disturbance":
      return "LAW";
    case "fire":
      return "FIRE";
    case "medical":
      return "EMS";
    case "welfare_check":
      return "OTHER";
    default:
      return "OTHER";
  }
}

function mapPriority(urgency: UrgencyLevel): PriorityKey {
  if (urgency === "critical") return "P1";
  if (urgency === "high") return "P2";
  return "P3";
}

function isOpenIncident(i: Incident): boolean {
  return i.status === "active" || i.status === "in_progress";
}

function formatElapsed(iso: string, now: Date): string {
  const ms = Math.max(0, now.getTime() - new Date(iso).getTime());
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}:${String(rm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

function shortIncidentId(id: string): string {
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return id.slice(-4).toUpperCase();
}

function langFlag(lang?: string | null): string | null {
  if (!lang) return null;
  const tag = lang.trim().toLowerCase().split("-")[0];
  if (!tag || tag === "en") return null;
  return tag.toUpperCase().slice(0, 2);
}

function parseCadPhase(raw: string | null): number {
  if (raw == null) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 3) return 1;
  return Math.floor(n);
}

// ─── Call volume chart ────────────────────────────────────────────────────────

function CallVolumeChart({
  data,
  currentHourIndex,
}: {
  data: { hour: string; calls: number }[];
  currentHourIndex: number;
}) {
  const MAX = Math.max(1, ...data.map((d) => d.calls));
  const CHART_H = 110;
  const BAR_W = 22;
  const STEP = 29;
  const START_X = 9;
  const BASE_Y = 125;

  return (
    <svg
      viewBox="0 0 240 155"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <rect width="240" height="155" fill="#060810" rx="6" />
      {[0, 0.33, 0.66, 1].map((pct, i) => {
        const y = BASE_Y - pct * CHART_H;
        return (
          <line
            key={i}
            x1="8"
            y1={y}
            x2="232"
            y2={y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        );
      })}
      {data.map((d, i) => {
        const bh = (d.calls / MAX) * CHART_H;
        const bx = START_X + i * STEP;
        const by = BASE_Y - bh;
        const isCurrent = i === currentHourIndex;
        return (
          <g key={d.hour}>
            <rect
              x={bx}
              y={by}
              width={BAR_W}
              height={Math.max(bh, d.calls > 0 ? 2 : 0)}
              rx="3"
              fill={isCurrent ? "rgba(59,130,246,0.85)" : "rgba(59,130,246,0.28)"}
              stroke={isCurrent ? "#3b82f6" : "rgba(59,130,246,0.4)"}
              strokeWidth="0.8"
            />
            {isCurrent && d.calls > 0 ? (
              <text
                x={bx + BAR_W / 2}
                y={by - 4}
                textAnchor="middle"
                fill="#93c5fd"
                fontSize="9"
                fontWeight="700"
                fontFamily="inherit"
              >
                {d.calls}
              </text>
            ) : null}
            <text
              x={bx + BAR_W / 2}
              y={BASE_Y + 12}
              textAnchor="middle"
              fill="#334155"
              fontSize="7.5"
              fontFamily="inherit"
            >
              {d.hour}
            </text>
          </g>
        );
      })}
      <text
        x="236"
        y={BASE_Y - CHART_H + 4}
        textAnchor="end"
        fill="#334155"
        fontSize="7.5"
        fontFamily="inherit"
      >
        {MAX}
      </text>
      <text x="236" y={BASE_Y + 4} textAnchor="end" fill="#334155" fontSize="7.5" fontFamily="inherit">
        0
      </text>
      <rect x="8" y="143" width="10" height="6" rx="2" fill="rgba(59,130,246,0.85)" />
      <text x="22" y="150" fill="#334155" fontSize="7.5" fontFamily="inherit">
        Current hour
      </text>
      <rect x="96" y="143" width="10" height="6" rx="2" fill="rgba(59,130,246,0.28)" />
      <text x="110" y="150" fill="#334155" fontSize="7.5" fontFamily="inherit">
        Prior hours
      </text>
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type PsapConsoleHomeProps = {
  agencyId: string;
  jurisdiction: string;
  agencyName: string;
  displayName: string;
  userEmail?: string;
  userRole?: string;
  /** Cognito user id — scopes welcome image per account. */
  userId?: string;
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
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PsapConsoleHome(props: PsapConsoleHomeProps) {
  return (
    <ThemeProvider storageKey="rc-theme-dispatcher">
      <PsapConsoleHomeInner {...props} />
    </ThemeProvider>
  );
}

function PsapConsoleHomeInner({
  agencyId,
  jurisdiction,
  agencyName,
  displayName,
  userEmail,
  userRole,
  userId = "",
}: PsapConsoleHomeProps) {
  const pathname = usePathname() ?? "";
  const abbr = agencyAbbr(agencyName, jurisdiction);
  const canCad = canEditCadPhase(userRole);
  const isDispatcher =
    (userRole ?? "").trim().toLowerCase() === "dispatcher";
  const apiLive = isApiConfigured();

  const nav = useMemo(() => {
    const ctx = buildNavContext({ agencyId }, jurisdiction);
    return filterRoleNavByFeatures(getRoleNav(userRole ?? "supervisor", ctx));
  }, [agencyId, jurisdiction, userRole]);

  const navItems = useMemo(() => flattenNavItems(nav), [nav]);
  const badgeCounts = useNavBadgeCounts(userRole);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", "psap-console", agencyId],
    queryFn: loadIncidents,
    refetchInterval: 30_000,
  });

  const operatorsQuery = useQuery({
    queryKey: ["supervisor-operators", "psap-console", agencyId],
    queryFn: fetchSupervisorOperators,
    enabled: apiLive && !isDispatcher,
    refetchInterval: 15_000,
  });

  const activeCallsQuery = useQuery({
    queryKey: ["supervisor-active-calls", "psap-console", agencyId],
    queryFn: fetchSupervisorActiveCalls,
    enabled: apiLive && canCad,
    refetchInterval: 15_000,
  });

  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);
  const operators = useMemo(() => operatorsQuery.data ?? [], [operatorsQuery.data]);
  const activeCalls = useMemo(() => activeCallsQuery.data ?? [], [activeCallsQuery.data]);
  const loading = incidentsQuery.isLoading;

  const [now, setNow] = useState(() => new Date());
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("presets");
  const [urlInput, setUrlInput] = useState("");
  const [cadOpen, setCadOpen] = useState(false);
  const [cadPhase, setCadPhase] = useState(1);
  const [selectedMapIncident, setSelectedMapIncident] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { rootRef } = useThemeRoot<HTMLDivElement>();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      setCadPhase(parseCadPhase(window.localStorage.getItem(cadPhaseStorageKey(agencyId))));
    } catch {
      setCadPhase(1);
    }
  }, [agencyId]);

  useEffect(() => {
    if (!userId) {
      setCustomBg(null);
      return;
    }
    setCustomBg(
      loadConsoleBg({
        userId,
        keyed: consoleBgStorageKey("psap", userId, agencyId),
        legacyKey: psapBgLegacyKey(agencyId),
      }),
    );
  }, [agencyId, userId]);

  const currentBg = customBg ?? DEFAULT_PSAP_BG;
  const hasCustomBg = Boolean(customBg);
  const clock = formatClock(now);
  const cadInfo = CAD_PHASES[cadPhase] ?? CAD_PHASES[1]!;

  const applyBg = useCallback(
    (url: string) => {
      setCustomBg(url);
      if (userId) {
        writeLocalStorage(consoleBgStorageKey("psap", userId, agencyId), url);
        if (url.startsWith("data:") || url.startsWith("http")) {
          writeAccountAvatar(userId, url);
        }
      }
      setShowModal(false);
      setUrlInput("");
    },
    [agencyId, userId],
  );

  const resetBg = useCallback(() => {
    setCustomBg(null);
    if (userId) {
      removeLocalStorage(consoleBgStorageKey("psap", userId, agencyId));
    }
    setShowModal(false);
  }, [agencyId, userId]);

  const setCadPhasePersisted = useCallback(
    (phase: number) => {
      if (!canCad) return;
      setCadPhase(phase);
      try {
        window.localStorage.setItem(cadPhaseStorageKey(agencyId), String(phase));
      } catch {
        /* ignore */
      }
      setCadOpen(false);
    },
    [agencyId, canCad],
  );

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

  const openIncidents = useMemo(() => incidents.filter(isOpenIncident), [incidents]);

  const mapIncidents = useMemo(() => psapIncidentsToMap(openIncidents), [openIncidents]);

  const operatorByIncident = useMemo(() => {
    const m = new Map<string, SupervisorOperatorPresence>();
    for (const op of operators) {
      if (op.activeIncidentId) m.set(op.activeIncidentId, op);
    }
    return m;
  }, [operators]);

  const callsToday = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return incidents.filter((i) => new Date(i.createdAt) >= start).length;
  }, [incidents, now]);

  const kpiActiveCalls =
    activeCalls.length > 0
      ? activeCalls.length
      : openIncidents.length;
  const kpiDispatchers =
    operators.length > 0
      ? String(operators.filter((o) => o.status === "online" || o.status === "on_call").length)
      : "—";
  const kpiQueue = openIncidents.filter((i) => i.status === "active").length;

  const activeCallsHref = findNavHref(navItems, "active-calls", "dispatcher", "incidents", "dashboard");
  const cadQueueHref = findNavHref(navItems, "cad-queue", "cad", "cad-audit");
  const transcriptsHref = findNavHref(navItems, "transcripts", "history");
  const reportsHref = findNavHref(navItems, "reports");
  const qaHref = findNavHref(navItems, "qa", "queue", "scorecards");
  const teamHref = findNavHref(navItems, "team", "users");
  const incidentsHref = findNavHref(navItems, "incidents", "dispatcher", "active-calls");
  const liveWorkspaceHref =
    findNavHref(navItems, "dispatcher") ?? `/${jurisdiction}/dispatcher`;
  const auditHref = findNavHref(navItems, "audit", "log");

  const quickActions = useMemo(() => {
    const actions: QuickActionDef[] = [];
    if (isDispatcher && liveWorkspaceHref) {
      actions.push({
        key: "live-workspace",
        label: "Live Workspace",
        href: liveWorkspaceHref,
        Icon: Headphones,
        bg: "rgba(30,58,95,0.55)",
        color: "#93c5fd",
        bdr: "rgba(59,130,246,0.35)",
      });
    }
    if (activeCallsHref) {
      actions.push({
        key: "active-calls",
        label: isDispatcher ? "My Queue" : "Active Calls",
        href: activeCallsHref,
        Icon: PhoneCall,
        bg: "rgba(30,58,95,0.4)",
        color: "#93c5fd",
        bdr: "rgba(59,130,246,0.2)",
      });
    }
    if (teamHref) {
      actions.push({
        key: "dispatchers",
        label: "Dispatcher Board",
        href: teamHref,
        Icon: Users,
        bg: "rgba(30,37,56,0.4)",
        color: C.textSub,
        bdr: C.border,
      });
    }
    if (qaHref) {
      actions.push({
        key: "qa",
        label: "QA Review",
        href: qaHref,
        Icon: Eye,
        bg: "rgba(6,78,59,0.35)",
        color: "#6ee7b7",
        bdr: "rgba(16,185,129,0.2)",
      });
    }
    if (cadQueueHref) {
      actions.push({
        key: "cad",
        label: "CAD Queue",
        href: cadQueueHref,
        Icon: Database,
        bg: "rgba(7,89,133,0.35)",
        color: "#67e8f9",
        bdr: "rgba(6,182,212,0.2)",
      });
    }
    if (transcriptsHref) {
      actions.push({
        key: "transcripts",
        label: "Transcripts",
        href: transcriptsHref,
        Icon: Activity,
        bg: "rgba(30,37,56,0.4)",
        color: C.textSub,
        bdr: C.border,
      });
    }
    if (reportsHref) {
      actions.push({
        key: "reports",
        label: "Reports",
        href: reportsHref,
        Icon: BarChart2,
        bg: "rgba(30,58,95,0.4)",
        color: "#93c5fd",
        bdr: "rgba(59,130,246,0.2)",
      });
    }
    return actions;
  }, [
    isDispatcher,
    liveWorkspaceHref,
    activeCallsHref,
    teamHref,
    qaHref,
    cadQueueHref,
    transcriptsHref,
    reportsHref,
  ]);

  const notifications = useMemo(() => {
    return openIncidents.slice(0, 8).map((inc) => {
      const ct = CALL_TYPES[mapCallType(inc.category)];
      const pr = PRIORITY[mapPriority(inc.urgency)];
      return {
        id: inc.incidentId,
        type: (pr.label === "P1" ? "error" : "info") as NotifType,
        title: `${pr.label} — ${ct.label}`,
        desc: inc.callerAddressLine || inc.cadLocation || inc.title || "Active call",
        time: formatTimeAgo(inc.updatedAt || inc.createdAt),
        href: incidentsHref,
      };
    });
  }, [openIncidents, incidentsHref]);

  const typeBreakdown = useMemo(() => {
    const counts: Record<CallTypeKey, number> = {
      LAW: 0,
      FIRE: 0,
      EMS: 0,
      TRAFFIC: 0,
      OTHER: 0,
    };
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todays = incidents.filter((i) => new Date(i.createdAt) >= todayStart);
    for (const i of todays) {
      counts[mapCallType(i.category)] += 1;
    }
    const total = todays.length || 1;
    const rows: { label: string; count: number; pct: number; color: string; rgb: string }[] = [
      { label: "Law Enforcement", count: counts.LAW, pct: Math.round((counts.LAW / total) * 100), color: "#3b82f6", rgb: "59,130,246" },
      { label: "EMS", count: counts.EMS, pct: Math.round((counts.EMS / total) * 100), color: "#f43f5e", rgb: "244,63,94" },
      { label: "Fire", count: counts.FIRE, pct: Math.round((counts.FIRE / total) * 100), color: "#ef4444", rgb: "239,68,68" },
      { label: "Traffic", count: counts.TRAFFIC, pct: Math.round((counts.TRAFFIC / total) * 100), color: "#f59e0b", rgb: "245,158,11" },
      { label: "Other", count: counts.OTHER, pct: Math.round((counts.OTHER / total) * 100), color: "#64748b", rgb: "100,116,139" },
    ];
    return { rows, total: todays.length };
  }, [incidents, now]);

  const volumeData = useMemo(() => {
    // Prefer a mock hourly curve shaped by today's volume; zeros when empty.
    if (callsToday === 0 && openIncidents.length === 0) {
      return MOCK_CALL_VOLUME.map((d) => ({ ...d, calls: 0 }));
    }
    const scale = Math.max(1, callsToday) / 31;
    return MOCK_CALL_VOLUME.map((d) => ({
      hour: d.hour,
      calls: Math.max(0, Math.round(d.calls * scale)),
    }));
  }, [callsToday, openIncidents.length]);

  const currentHourIndex = Math.min(
    volumeData.length - 1,
    Math.max(0, now.getHours() >= 6 ? Math.min(now.getHours() - 6, volumeData.length - 1) : 0),
  );

  const badgeForItem = (item: NavItem): number | null => {
    if (!item.badge || item.badge.type !== "count") return null;
    if (item.badge.key === "activeCalls" || item.badge.key === "openIncidents") {
      const n = badgeCounts[item.badge.key] ?? kpiActiveCalls;
      return n > 0 ? n : null;
    }
    const n = badgeCounts[item.badge.key] ?? 0;
    return n > 0 ? n : null;
  };

  const systemStatus = useMemo(
    () => [
      { label: "AI Transcription", status: "online" as const, note: "< 2s latency" },
      { label: "Live Translation", status: "online" as const, note: "40+ languages" },
      {
        label: "CAD Sync",
        status: cadPhase === 0 ? ("online" as const) : ("active" as const),
        note: cadInfo.label,
      },
      { label: "SMS Intake", status: "online" as const, note: "Connected" },
      { label: "WebSocket", status: "online" as const, note: "Real-time OK" },
      { label: "Media Intake", status: "online" as const, note: "Photo + video" },
    ],
    [cadPhase, cadInfo.label],
  );

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
      label: "ACTIVE CALLS",
      value: loading ? "…" : kpiActiveCalls,
      color: kpiActiveCalls > 0 ? C.red : C.text,
      icon: <PhoneCall size={17} color={C.red} strokeWidth={1.7} />,
      iconBg: "rgba(239,68,68,0.15)",
      linkLabel: isDispatcher ? "Open live workspace" : "View active calls",
      href: isDispatcher
        ? liveWorkspaceHref
        : (activeCallsHref ?? incidentsHref),
    },
    {
      label: isDispatcher ? "LIVE WORKSPACE" : "DISPATCHERS ON DUTY",
      value: isDispatcher
        ? "Enter"
        : loading && operators.length === 0
          ? "…"
          : kpiDispatchers,
      color: C.text,
      icon: isDispatcher ? (
        <Headphones size={17} color={C.blue} strokeWidth={1.7} />
      ) : (
        <Users size={17} color={C.blue} strokeWidth={1.7} />
      ),
      iconBg: "rgba(59,130,246,0.15)",
      linkLabel: isDispatcher ? "Open call-taking console" : "View dispatcher board",
      href: isDispatcher ? liveWorkspaceHref : teamHref,
    },
    {
      label: "QUEUE DEPTH",
      value: loading ? "…" : kpiQueue,
      color: kpiQueue > 0 ? C.amber : C.text,
      icon: <Clock size={17} color={C.amber} strokeWidth={1.7} />,
      iconBg: "rgba(245,158,11,0.15)",
      linkLabel: "Open call queue",
      href: incidentsHref ?? activeCallsHref,
    },
    {
      label: "CALLS TODAY",
      value: loading ? "…" : callsToday,
      color: C.text,
      icon: <BarChart2 size={17} color={C.green} strokeWidth={1.7} />,
      iconBg: "rgba(16,185,129,0.15)",
      linkLabel: "View call reports",
      href: reportsHref,
    },
  ];

  return (
    <HelpChrome role={userRole ?? "supervisor"}>
      <div
        ref={rootRef}
        data-theme="dark"
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: C.bg,
          fontFamily: FONT,
          color: C.text,
          fontSize: "14px",
          position: "relative",
        }}
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
              <div
                style={{
                  width: 34,
                  height: 34,
                  background: "linear-gradient(135deg,#1d4ed8,#1e3a5f)",
                  borderRadius: 7,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "-0.5px",
                  flexShrink: 0,
                }}
              >
                RC
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#fff",
                    letterSpacing: "0.5px",
                    lineHeight: 1,
                  }}
                >
                  RAPID <span style={{ color: C.blue }}>CORTEX</span>
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: C.blue,
                    letterSpacing: "2.5px",
                    marginTop: 2,
                  }}
                >
                  9-1-1
                </div>
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, padding: 7, overflowY: "auto" }} aria-label="PSAP navigation">
            {navItems.map((item) => {
              const Icon = navIconByName(item.icon);
              const active = navItemActive(pathname, item);
              const count = badgeForItem(item);
              const content = (
                <>
                  <Icon size={15} color={active ? C.blue : C.textSub} strokeWidth={1.7} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 400,
                      color: active ? C.text : "#64748b",
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
                background: active ? "rgba(59,130,246,0.13)" : "transparent",
                borderLeft: active ? `2px solid ${C.blue}` : "2px solid transparent",
                marginBottom: 1,
                textDecoration: "none",
                color: "inherit",
              };
              if (item.external) {
                return (
                  <a key={item.id} href={item.href} target="_blank" rel="noreferrer" style={rowStyle}>
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
          </nav>

          <div style={{ borderTop: `1px solid ${C.border}` }}>
            <div
              style={{
                padding: "11px 14px",
                display: "flex",
                alignItems: "center",
                gap: 9,
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: CREST_BG,
                  border: `2px solid ${C.borderHard}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {abbr}
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
                  {agencyName}
                </div>
                <div style={{ fontSize: 10, color: C.textSub }}>{nav.roleBadge}</div>
              </div>
            </div>

            <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: customBg
                    ? `center / cover no-repeat url(${JSON.stringify(customBg)})`
                    : "linear-gradient(135deg,#1d4ed8,#1e40af)",
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
                <div style={{ fontSize: 10, color: C.textSub }}>{nav.roleBadge}</div>
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
                    background: CREST_BG,
                    border: `2px solid ${C.borderHard}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {abbr}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{agencyName}</div>
                  <div style={{ fontSize: 10.5, color: C.textSub }}>
                    Emergency Communications Center
                  </div>
                </div>

                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => canCad && setCadOpen((v) => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      background: cadInfo.bg,
                      border: `1px solid ${cadInfo.border}`,
                      borderRadius: 6,
                      cursor: canCad ? "pointer" : "default",
                      fontFamily: "inherit",
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={cadOpen}
                  >
                    <Database size={11} color={cadInfo.color} strokeWidth={1.7} />
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: cadInfo.color,
                        letterSpacing: "0.5px",
                      }}
                    >
                      {cadInfo.label}
                    </span>
                    {canCad ? <ChevronDown size={11} color={cadInfo.color} /> : null}
                  </button>
                  {cadOpen && canCad ? (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        width: 170,
                        background: "#080c18",
                        border: `1px solid ${C.borderHard}`,
                        borderRadius: 8,
                        overflow: "hidden",
                        zIndex: 300,
                      }}
                      role="listbox"
                    >
                      <div
                        style={{
                          padding: "8px 12px 6px",
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
                          CAD INTEGRATION PHASE
                        </span>
                      </div>
                      {CAD_PHASES.map((p) => (
                        <button
                          key={p.phase}
                          type="button"
                          onClick={() => setCadPhasePersisted(p.phase)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: p.phase === cadPhase ? p.bg : "transparent",
                            border: "none",
                            borderLeft: `2px solid ${p.phase === cadPhase ? p.color : "transparent"}`,
                            fontFamily: "inherit",
                            textAlign: "left",
                          }}
                        >
                          <Database size={11} color={p.color} strokeWidth={1.7} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: p.color }}>
                            {p.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
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
                      background: C.green,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                      Rapid Cortex Network
                    </div>
                    <div style={{ fontSize: 10, color: C.green }}>All Systems Operational</div>
                  </div>
                </div>
                <CampusDashboardHeaderUtilities
                  email={userEmail}
                  role={userRole}
                  agencyId={agencyId}
                  userId={userId}
                  leadingSlot={<ThemeToggle variant="inline" />}
                />
              </div>
            </header>

            <div
              style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}
              onClick={() => cadOpen && setCadOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && cadOpen) setCadOpen(false);
              }}
              role="presentation"
            >
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
                      "linear-gradient(90deg,rgba(9,13,26,0.8) 0%,rgba(9,13,26,0.4) 55%,rgba(9,13,26,0.15) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg,rgba(9,13,26,0.2) 0%,rgba(9,13,26,0.05) 30%,rgba(9,13,26,0.72) 72%,rgba(9,13,26,1) 100%)",
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
                      {agencyName} — Current shift overview.
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
                          background: "rgba(9,13,26,0.9)",
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
                              color: C.blue,
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
                {/* Call queue */}
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
                      ACTIVE CALL QUEUE
                    </span>
                    {incidentsHref ? (
                      <Link
                        href={incidentsHref}
                        style={{
                          fontSize: 11,
                          color: C.blue,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        View all
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ padding: "0 8px 8px", minHeight: 120 }}>
                    {loading && openIncidents.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>Loading…</div>
                    ) : openIncidents.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>
                        No active calls in queue.
                      </div>
                    ) : (
                      openIncidents.slice(0, 4).map((inc) => {
                        const ct = CALL_TYPES[mapCallType(inc.category)];
                        const pr = PRIORITY[mapPriority(inc.urgency)];
                        const op = operatorByIncident.get(inc.incidentId);
                        const translate = langFlag(inc.callerLanguage);
                        const location =
                          inc.callerAddressLine ||
                          inc.cadLocation ||
                          inc.title ||
                          "Location pending";
                        return (
                          <div
                            key={inc.incidentId}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 9,
                              padding: "8px 8px",
                              borderRadius: 7,
                              borderLeft: `3px solid ${ct.color}`,
                              background:
                                pr.label === "P1"
                                  ? "rgba(239,68,68,0.04)"
                                  : "rgba(249,115,22,0.04)",
                              marginBottom: 6,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  marginBottom: 3,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    background: ct.bg,
                                    color: ct.color,
                                    border: `1px solid ${ct.border}`,
                                  }}
                                >
                                  {ct.label}
                                </span>
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    background: pr.bg,
                                    color: pr.color,
                                    border: `1px solid ${pr.border}`,
                                  }}
                                >
                                  {pr.label}
                                </span>
                                {translate ? (
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      padding: "1px 5px",
                                      borderRadius: 3,
                                      background: "rgba(139,92,246,0.18)",
                                      color: "#c4b5fd",
                                      border: "1px solid rgba(139,92,246,0.3)",
                                    }}
                                  >
                                    {translate}
                                  </span>
                                ) : null}
                                <span
                                  style={{
                                    fontSize: 9,
                                    color: C.textMuted,
                                    marginLeft: "auto",
                                  }}
                                >
                                  #{shortIncidentId(inc.incidentId)}
                                </span>
                              </div>
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
                                {location}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginTop: 4,
                                }}
                              >
                                <span style={{ fontSize: 10.5, color: C.textSub }}>
                                  D: {op?.displayName ?? "Unassigned"}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <Mic size={10} color={C.green} strokeWidth={2} />
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      color: C.amber,
                                    }}
                                  >
                                    {formatElapsed(inc.createdAt, now)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {incidentsHref ? (
                    <Link
                      href={incidentsHref}
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
                      Open call queue <ArrowRight size={12} strokeWidth={1.7} />
                    </Link>
                  ) : null}
                </div>

                {/* Dispatcher board — or live workspace CTA for dispatcher role */}
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
                      {isDispatcher ? "LIVE WORKSPACE" : "DISPATCHER BOARD"}
                    </span>
                    {!isDispatcher && teamHref ? (
                      <Link
                        href={teamHref}
                        style={{
                          fontSize: 11,
                          color: C.blue,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        Full view
                      </Link>
                    ) : null}
                  </div>
                  {isDispatcher ? (
                    <div style={{ padding: "8px 15px 16px" }}>
                      <p style={{ fontSize: 12, color: C.textSub, margin: "0 0 12px", lineHeight: 1.45 }}>
                        Open the call-taking console for live transcription, CAD, and your active
                        incident queue.
                      </p>
                      <Link
                        href={liveWorkspaceHref}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: "rgba(59,130,246,0.18)",
                          border: "1px solid rgba(59,130,246,0.35)",
                          color: "#93c5fd",
                          fontSize: 13,
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        <Headphones size={16} strokeWidth={1.8} />
                        Enter Live Workspace
                        <ArrowRight size={14} strokeWidth={1.8} />
                      </Link>
                    </div>
                  ) : (
                    <>
                  <div style={{ padding: "0 8px 8px", minHeight: 120 }}>
                    {operatorsQuery.isLoading && operators.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>Loading…</div>
                    ) : operators.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>
                        No dispatcher stations online. Presence appears when operators connect.
                      </div>
                    ) : (
                      operators.slice(0, 8).map((op, i) => {
                        const statusKey =
                          op.status === "on_call" ? "oncall" : ("available" as const);
                        const ss = STATUS_STYLE[statusKey];
                        return (
                          <div
                            key={op.userId}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 8px",
                              borderRadius: 7,
                              marginBottom: 4,
                              background: "rgba(255,255,255,0.02)",
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#fff",
                                flexShrink: 0,
                              }}
                            >
                              {initialsFromName(op.displayName)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: C.text,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {op.displayName}
                              </div>
                              <div style={{ fontSize: 10.5, color: C.textSub }}>{op.role}</div>
                            </div>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: ss.bg,
                                color: ss.color,
                                border: `1px solid ${ss.border}`,
                              }}
                            >
                              {ss.label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {teamHref ? (
                    <Link
                      href={teamHref}
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
                      View dispatcher board <ArrowRight size={12} strokeWidth={1.7} />
                    </Link>
                  ) : null}
                    </>
                  )}
                </div>

                {/* Call volume */}
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
                      CALL VOLUME — TODAY
                    </span>
                    {reportsHref ? (
                      <Link
                        href={reportsHref}
                        style={{
                          fontSize: 11,
                          color: C.blue,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        Reports
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ padding: "4px 10px 12px" }}>
                    <CallVolumeChart data={volumeData} currentHourIndex={currentHourIndex} />
                  </div>
                </div>
              </div>

              {/* Operational Map */}
              <div style={{ padding: "0 16px 12px" }}>
                <div
                  style={{
                    ...card(),
                    overflow: "hidden",
                    height: 480,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: `1px solid ${C.border}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <MapPin size={13} color={C.textSub} />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.textSub,
                        letterSpacing: "0.05em",
                      }}
                    >
                      OPERATIONAL MAP
                    </span>
                  </div>
                  <RapidCortexMap
                    incidents={mapIncidents}
                    selectedIncidentId={selectedMapIncident}
                    onIncidentClick={(inc) => setSelectedMapIncident(inc.id)}
                    vertical="core"
                    height="432px"
                    showLayerControl
                  />
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
                            }}
                          >
                            <Icon size={19} color={a.color} strokeWidth={1.7} />
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                color: a.color,
                                textAlign: "center",
                                lineHeight: 1.3,
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
                        key: "qa",
                        Icon: Eye,
                        label: "QA & COACHING",
                        desc: "Review call scores, coaching notes, and dispatcher performance.",
                        link: "Open QA Tools",
                        color: C.green,
                        rgb: "16,185,129",
                        href: qaHref,
                      },
                      {
                        key: "reports",
                        Icon: BarChart2,
                        label: "REPORTS",
                        desc: "Call volume, handle time, incident type, and language analytics.",
                        link: "View Reports",
                        color: C.blue,
                        rgb: "59,130,246",
                        href: reportsHref,
                      },
                      {
                        key: "training",
                        Icon: Headphones,
                        label: "TRAINING",
                        desc: "Access dispatcher training modules, SOPs, and protocol guides.",
                        link: "View Training",
                        color: C.purple,
                        rgb: "139,92,246",
                        href: "mailto:support@rapidcortex.us?subject=RC%20911%20training",
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
                    if (u.href.startsWith("mailto:")) {
                      return (
                        <a
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
                        </a>
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
              {auditHref || incidentsHref ? (
                <Link
                  href={auditHref ?? incidentsHref!}
                  style={{
                    fontSize: 11,
                    color: C.blue,
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
                  No active call alerts.
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
                    AI SYSTEM STATUS
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
                    <span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>All Online</span>
                  </div>
                </div>
                {systemStatus.map((s, i) => {
                  const isOnline = s.status === "online";
                  const isActive = s.status === "active";
                  const dotColor = isOnline ? C.green : isActive ? C.amber : C.red;
                  const textColor = isOnline ? C.green : isActive ? C.amber : C.red;
                  return (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom:
                          i < systemStatus.length - 1 ? `1px solid ${C.border}` : "none",
                      }}
                    >
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: dotColor,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text }}>
                          {s.label}
                        </div>
                        <div style={{ fontSize: 10, color: C.textMuted }}>{s.note}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: textColor }}>
                        {isOnline ? "Online" : isActive ? "Active" : "Error"}
                      </span>
                    </div>
                  );
                })}
              </div>

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
                    TODAY&apos;S CALL TYPES
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: C.blue }}>
                    {typeBreakdown.total} Total
                  </span>
                </div>
                {typeBreakdown.rows.map((row) => (
                  <div key={row.label} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ fontSize: 11, color: C.textSub }}>{row.label}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: row.color }}>
                          {row.count}
                        </span>
                        <span style={{ fontSize: 10, color: C.textMuted }}>{row.pct}%</span>
                      </div>
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
                          width: `${row.pct}%`,
                          background: `rgba(${row.rgb},0.7)`,
                          borderRadius: 2,
                          minWidth: row.count > 0 ? 4 : 0,
                        }}
                      />
                    </div>
                  </div>
                ))}
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
              background: "rgba(0,0,0,0.78)",
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
              aria-label="Change agency background"
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
                    {agencyName} — stored locally for this browser
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
                      borderBottom: `2px solid ${modalTab === tab.id ? C.blue : "transparent"}`,
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: modalTab === tab.id ? 600 : 400,
                      color: modalTab === tab.id ? C.blue : C.textSub,
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
                      Select a background representing your agency&apos;s jurisdiction or dispatch
                      center.
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
                              border: `2px solid ${isActive ? C.blue : C.border}`,
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
                                    background: C.blue,
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
                      Paste a direct image URL representing this agency&apos;s jurisdiction.
                    </p>
                    <div style={{ display: "flex", gap: 9 }}>
                      <input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/city-photo.jpg"
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
                          background: "#1d4ed8",
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
                          background: `url(${urlInput}) center/cover no-repeat, #0a0f1e`,
                          border: `1px solid ${C.border}`,
                        }}
                      />
                    ) : null}
                  </>
                ) : null}

                {modalTab === "upload" ? (
                  <>
                    <p style={{ fontSize: 12, color: C.textSub, margin: "0 0 16px" }}>
                      Upload a photo representing this agency&apos;s jurisdiction or facility.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: "2px dashed rgba(59,130,246,0.3)",
                        borderRadius: 10,
                        padding: "38px 20px",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "rgba(59,130,246,0.04)",
                        width: "100%",
                        fontFamily: "inherit",
                        color: "inherit",
                      }}
                    >
                      <Upload
                        size={26}
                        color={C.blue}
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
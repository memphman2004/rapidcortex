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
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  Link2,
  MapPin,
  QrCode,
  Shield,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { HelpChrome } from "@/components/help/help-chrome";
import { IncidentCameraPanel } from "@/components/venue/IncidentCameraPanel";
import { SiteSquareMark } from "@/components/brand/site-logo-link";
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import { loadMapTheme, saveMapTheme } from "@/lib/maps/persisted-map-prefs";
import { campusIncidentsToMap } from "@/components/maps/map-incident-adapters";
import { buildNavContext } from "@/lib/navigation/nav-context";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { navIconByName } from "@/lib/navigation/nav-icons";
import {
  getRoleNav,
  type NavItem,
  type RoleNav,
} from "@/lib/navigation/role-nav";
import { useNavBadgeCounts } from "@/lib/navigation/use-nav-badge-counts";
import type { CampusIncident } from "@/lib/campus/types";
import { CAMPUS_DASHBOARD_FONT_FAMILY } from "./campus-dashboard-font";
import { CampusDashboardHeaderUtilities } from "./campus-dashboard-header-utilities";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  formatTimeAgo,
  mapIncidentType,
  useCampusDashboard,
} from "./use-campus-dashboard";
import {
  consoleBgStorageKey,
  loadConsoleBg,
  removeLocalStorage,
  writeAccountAvatar,
  writeLocalStorage,
} from "@/lib/account/account-picture";
import { C } from "@/lib/theme/rc-theme-tokens";

// ─── Design tokens (theme-aware CSS vars via C) ───────────────────────────────

const CREST_BG = "var(--rc-crest)";

const DEFAULT_CAMPUS_BG =
  "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1920&q=80";

const PRESETS = [
  {
    label: "University Campus",
    fallback: "#1a3525",
    url: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Campus Aerial",
    fallback: "#1e3a5f",
    url: "https://images.unsplash.com/photo-1541339907198-b5abd3c15a91?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Football Stadium",
    fallback: "#3d1a0a",
    url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Hospital Campus",
    fallback: "#0a2a1a",
    url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Convention Center",
    fallback: "#1a1a3d",
    url: "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Airport Terminal",
    fallback: "#2a1a0a",
    url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1920&q=80",
  },
] as const;

const AVATAR_COLORS = ["#4f46e5", "#0891b2", "#7c3aed", "#0f766e", "#b45309", "#be185d"];

const nColors = {
  error: { dot: C.red, bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" },
  info: { dot: C.blue, bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)" },
  warning: { dot: C.amber, bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
  success: { dot: C.green, bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)" },
} as const;

type NotifType = keyof typeof nColors;

function card(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: "10px",
    ...extra,
  };
}

function campusBgLegacyKey(agencyId: string): string {
  return `rc-campus-bg:${agencyId}`;
}

function campusAbbr(campusCode: string): string {
  const cleaned = campusCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length <= 3) return cleaned || "RC";
  return cleaned.slice(0, 3);
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

function roleSubtitle(role?: string): string {
  const upper = (role ?? "").trim().toUpperCase();
  switch (upper) {
    case "CAMPUS_ADMIN":
      return "Public Safety Dashboard";
    case "CAMPUS_SUPERVISOR":
      return "Supervisor Dashboard";
    case "CAMPUS_SECURITY":
      return "Security Dashboard";
    case "CAMPUS_DISPATCH":
      return "Dispatch Dashboard";
    case "CAMPUS_FACULTY":
      return "Faculty Safety Dashboard";
    case "CAMPUS_COUNSELOR":
      return "Counselor Dashboard";
    default:
      return "Public Safety Dashboard";
  }
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

function incidentEmoji(type: CampusIncident["type"]): string {
  switch (type) {
    case "medical":
      return "🏥";
    case "mental_health":
      return "💜";
    case "active_threat":
      return "🚨";
    case "suspicious_activity":
      return "⚠️";
    case "property_crime":
      return "🔒";
    case "maintenance":
      return "🔧";
    case "wellness_check":
      return "🩺";
    case "security":
      return "🛡️";
    default:
      return "📋";
  }
}

function incidentSeverity(type: CampusIncident["type"]): string {
  if (type === "active_threat") return "CRITICAL";
  if (type === "medical" || type === "suspicious_activity") return "HIGH";
  if (type === "security" || type === "mental_health") return "MEDIUM";
  return "LOW";
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

function formatReportedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Zone map ─────────────────────────────────────────────────────────────────

function ZoneMap({ zoneLabels }: { zoneLabels: string[] }) {
  const labels = [
    zoneLabels[0] ?? "North Campus",
    zoneLabels[1] ?? "Central Quad",
    zoneLabels[2] ?? "West Campus",
    zoneLabels[3] ?? "East Campus",
  ];

  return (
    <svg
      viewBox="0 0 240 190"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <rect width="240" height="190" fill="#060b15" rx="6" />
      {[40, 80, 120, 160, 200].map((x) => (
        <line
          key={`v${x}`}
          x1={x}
          y1="0"
          x2={x}
          y2="190"
          stroke="rgba(255,255,255,0.035)"
          strokeWidth="1"
        />
      ))}
      {[38, 76, 114, 152].map((y) => (
        <line
          key={`h${y}`}
          x1="0"
          y1={y}
          x2="240"
          y2={y}
          stroke="rgba(255,255,255,0.035)"
          strokeWidth="1"
        />
      ))}

      <polygon
        points="55,12 185,12 192,64 48,64"
        fill="rgba(59,130,246,0.13)"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeDasharray="4,2"
      />
      <text
        x="120"
        y="42"
        textAnchor="middle"
        fill="#93c5fd"
        fontSize="11"
        fontWeight="700"
        fontFamily="inherit"
      >
        {labels[0]!.length > 16 ? `${labels[0]!.slice(0, 14)}…` : labels[0]}
      </text>

      <rect
        x="62"
        y="72"
        width="116"
        height="50"
        rx="4"
        fill="rgba(16,185,129,0.12)"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeDasharray="4,2"
      />
      <text
        x="120"
        y="102"
        textAnchor="middle"
        fill="#6ee7b7"
        fontSize="11"
        fontWeight="700"
        fontFamily="inherit"
      >
        {labels[1]!.length > 16 ? `${labels[1]!.slice(0, 14)}…` : labels[1]}
      </text>

      <polygon
        points="8,130 86,130 80,186 8,186"
        fill="rgba(168,85,247,0.12)"
        stroke="#a855f7"
        strokeWidth="1.5"
        strokeDasharray="4,2"
      />
      <text
        x="46"
        y="162"
        textAnchor="middle"
        fill="#c4b5fd"
        fontSize="10"
        fontWeight="700"
        fontFamily="inherit"
      >
        {labels[2]!.length > 12 ? `${labels[2]!.slice(0, 10)}…` : labels[2]}
      </text>

      <polygon
        points="154,130 232,130 232,186 162,186"
        fill="rgba(245,158,11,0.12)"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeDasharray="4,2"
      />
      <text
        x="194"
        y="162"
        textAnchor="middle"
        fill="#fcd34d"
        fontSize="10"
        fontWeight="700"
        fontFamily="inherit"
      >
        {labels[3]!.length > 12 ? `${labels[3]!.slice(0, 10)}…` : labels[3]}
      </text>

      {[
        { x: 96, y: 28, c: "#3b82f6" },
        { x: 120, y: 96, c: "#10b981" },
        { x: 42, y: 154, c: "#a855f7" },
        { x: 188, y: 156, c: "#f59e0b" },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="8" fill={p.c} opacity="0.15" />
          <circle cx={p.x} cy={p.y} r="4.5" fill={p.c} opacity="0.9" />
        </g>
      ))}
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type CampusConsoleHomeProps = {
  agencyId: string;
  campusCode: string;
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

export function CampusConsoleHome(props: CampusConsoleHomeProps) {
  return (
    <ThemeProvider storageKey="rc-theme-campus">
      <CampusConsoleHomeInner {...props} />
    </ThemeProvider>
  );
}

function CampusConsoleHomeInner({
  agencyId,
  campusCode,
  agencyName,
  displayName,
  userEmail,
  userRole,
  userId = "",
}: CampusConsoleHomeProps) {
  const pathname = usePathname() ?? "";
  // Nav hrefs are rooted at /app/campus/{CODE} via getRoleNav (campusCode below).
  const codeUpper = campusCode.toUpperCase();
  const abbr = campusAbbr(codeUpper);
  const isAdmin = (userRole ?? "").trim().toUpperCase() === "CAMPUS_ADMIN";

  const navRole = isRcInternalOperator(userRole ?? "")
    ? "CAMPUS_ADMIN"
    : (userRole ?? "CAMPUS_SECURITY");

  const nav = useMemo(() => {
    const ctx = buildNavContext({ agencyId }, undefined);
    return filterRoleNavByFeatures(
      getRoleNav(navRole, { ...ctx, campusCode: codeUpper }),
    );
  }, [agencyId, navRole, codeUpper]);

  const navItems = useMemo(() => flattenNavItems(nav), [nav]);
  const badgeCounts = useNavBadgeCounts(userRole);
  const openIncidentCount = badgeCounts.openIncidents;

  const {
    loading,
    error,
    stats,
    zones,
    buildings,
    onDuty,
    incidents,
    activeCameraIncident,
    clearActiveCameraIncident,
  } = useCampusDashboard(agencyId, codeUpper);

  const [now, setNow] = useState(() => new Date());
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("presets");
  const [urlInput, setUrlInput] = useState("");
  const [selectedMapIncident, setSelectedMapIncident] = useState<string | null>(null);
  const [mapTheme, setMapTheme] = useState<"dark" | "light">("dark");
  const fileRef = useRef<HTMLInputElement>(null);
  const { rootRef } = useThemeRoot<HTMLDivElement>();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setMapTheme(loadMapTheme(userId, "campus", "dark"));
  }, [userId]);

  const onMapThemeChange = useCallback(
    (next: "dark" | "light") => {
      setMapTheme(next);
      saveMapTheme(userId || null, "campus", next);
    },
    [userId],
  );
  useEffect(() => {
    if (!userId) {
      setCustomBg(null);
      return;
    }
    setCustomBg(
      loadConsoleBg({
        userId,
        keyed: consoleBgStorageKey("campus", userId, agencyId),
        legacyKey: campusBgLegacyKey(agencyId),
      }),
    );
  }, [agencyId, userId]);

  const currentBg = customBg ?? DEFAULT_CAMPUS_BG;
  const hasCustomBg = Boolean(customBg);
  const clock = formatClock(now);

  // Production persistence would PATCH agency settings + S3; localStorage is session/device only for now.
  const applyBg = useCallback(
    (url: string) => {
      setCustomBg(url);
      if (userId) {
        writeLocalStorage(consoleBgStorageKey("campus", userId, agencyId), url);
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
      removeLocalStorage(consoleBgStorageKey("campus", userId, agencyId));
    }
    setShowModal(false);
  }, [agencyId, userId]);

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

  const openIncidents = useMemo(
    () =>
      incidents.filter(
        (i) => i.status === "open" || i.status === "assigned" || i.status === "responding",
      ),
    [incidents],
  );

  const mapIncidents = useMemo(() => campusIncidentsToMap(openIncidents), [openIncidents]);

  const buildingsOnline = useMemo(() => {
    if (buildings.length === 0) {
      return stats ? String(stats.buildingsMonitored) : "—";
    }
    const online = buildings.filter((b) => b.status !== "closed").length;
    return `${online} / ${buildings.length}`;
  }, [buildings, stats]);

  const kpiIncidents = stats?.activeIncidents ?? openIncidents.length;
  const kpiResponders = stats?.respondersOnDuty ?? onDuty.length;
  const kpiZones = zones.length > 0 ? zones.length : "—";

  const incidentsHref = findNavHref(navItems, "incidents");
  const buildingsHref = findNavHref(navItems, "buildings");
  const zonesHref = findNavHref(navItems, "zones");
  const qrHref = findNavHref(navItems, "qr");
  const reportsHref = findNavHref(navItems, "reports");
  const camerasHref = findNavHref(navItems, "cameras");
  const usersHref = findNavHref(navItems, "users");
  const settingsHref = findNavHref(navItems, "settings");

  const quickActions = useMemo(() => {
    const tile = {
      bg: "color-mix(in srgb, var(--rc-blue) 14%, var(--rc-surface))",
      color: "var(--rc-text-primary)",
      bdr: "var(--rc-border)",
    };
    const danger = {
      bg: "color-mix(in srgb, var(--rc-red, #ef4444) 14%, var(--rc-surface))",
      color: "var(--rc-text-primary)",
      bdr: "var(--rc-border)",
    };
    const actions: QuickActionDef[] = [];
    if (incidentsHref) {
      actions.push({
        key: "report",
        label: "Report Incident",
        href: incidentsHref,
        Icon: AlertTriangle,
        ...danger,
      });
    }
    if (buildingsHref) {
      actions.push({
        key: "buildings",
        label: "Buildings",
        href: buildingsHref,
        Icon: Building2,
        ...tile,
      });
    }
    if (zonesHref) {
      actions.push({
        key: "zones",
        label: "Zones",
        href: zonesHref,
        Icon: Shield,
        ...tile,
      });
    }
    if (qrHref) {
      actions.push({
        key: "qr",
        label: "QR / NFC",
        href: qrHref,
        Icon: QrCode,
        ...tile,
      });
    }
    if (reportsHref) {
      actions.push({
        key: "reports",
        label: "Reports",
        href: reportsHref,
        Icon: BarChart2,
        ...tile,
      });
    }
    if (camerasHref) {
      actions.push({
        key: "cameras",
        label: "Cameras",
        href: camerasHref,
        Icon: Camera,
        ...tile,
      });
    }
    return actions;
  }, [incidentsHref, buildingsHref, zonesHref, qrHref, reportsHref, camerasHref]);

  const checklist = useMemo(() => {
    if (!isAdmin) return [];
    const items: { label: string; href: string; done: boolean }[] = [];
    if (buildingsHref) {
      items.push({
        label: "Add Buildings",
        href: buildingsHref,
        done: buildings.length > 0,
      });
    }
    if (zonesHref) {
      items.push({
        label: "Define Zones",
        href: zonesHref,
        done: zones.length > 0,
      });
    }
    if (qrHref) {
      items.push({
        label: "Deploy QR/NFC Devices",
        href: qrHref,
        done: false,
      });
    }
    if (usersHref) {
      items.push({
        label: "Add Responders",
        href: usersHref,
        done: onDuty.length > 0,
      });
    }
    if (settingsHref) {
      items.push({
        label: "Review Campus Settings",
        href: settingsHref,
        done: false,
      });
    }
    return items;
  }, [
    isAdmin,
    buildingsHref,
    zonesHref,
    qrHref,
    usersHref,
    settingsHref,
    buildings.length,
    zones.length,
    onDuty.length,
  ]);

  const checklistDone = checklist.filter((c) => c.done).length;
  const checklistPct =
    checklist.length === 0 ? 0 : Math.round((checklistDone / checklist.length) * 100);

  const notifications = useMemo(() => {
    return openIncidents.slice(0, 8).map((inc) => ({
      id: inc.id,
      type: "error" as NotifType,
      title: `Active Incident: ${inc.buildingLabel || "Campus"}`,
      desc: mapIncidentType(inc.type),
      time: formatTimeAgo(inc.updatedAt || inc.createdAt),
      href: incidentsHref,
    }));
  }, [openIncidents, incidentsHref]);

  const badgeForItem = (item: NavItem): number | null => {
    if (!item.badge || item.badge.type !== "count") return null;
    if (item.badge.key === "openIncidents") {
      const n = openIncidentCount ?? openIncidents.length;
      return n > 0 ? n : null;
    }
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
      label: "ACTIVE INCIDENTS",
      value: loading ? "…" : kpiIncidents,
      color: kpiIncidents > 0 ? C.red : C.text,
      icon: <AlertTriangle size={17} color={C.red} strokeWidth={1.7} />,
      iconBg: "rgba(239,68,68,0.15)",
      linkLabel: "View all incidents",
      href: incidentsHref,
    },
    {
      label: "RESPONDERS ON DUTY",
      value: loading ? "…" : kpiResponders,
      color: C.text,
      icon: <Users size={17} color={C.blue} strokeWidth={1.7} />,
      iconBg: "rgba(59,130,246,0.15)",
      linkLabel: "View responders",
      href: usersHref ?? settingsHref,
    },
    {
      label: "BUILDINGS ONLINE",
      value: loading ? "…" : buildingsOnline,
      color: C.text,
      icon: <Building2 size={17} color={C.green} strokeWidth={1.7} />,
      iconBg: "rgba(16,185,129,0.15)",
      linkLabel: "View building status",
      href: buildingsHref,
    },
    {
      label: "ZONES MONITORED",
      value: loading ? "…" : kpiZones,
      color: C.text,
      icon: <Shield size={17} color={C.blue} strokeWidth={1.7} />,
      iconBg: "rgba(59,130,246,0.15)",
      linkLabel: "View all zones",
      href: zonesHref,
    },
  ];

  const zoneLabels = zones.map((z) => z.zoneName);

  return (
    <HelpChrome role={userRole ?? "CAMPUS_SECURITY"}>
      <div
        ref={rootRef}
        data-theme="dark"
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: C.bg,
          fontFamily: CAMPUS_DASHBOARD_FONT_FAMILY,
          color: C.text,
          fontSize: "14px",
          position: "relative",
        }}
      >
        {/* ══ LEFT SIDEBAR ═══════════════════════════════════════════════════ */}
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
                  CAMPUS
                </div>
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, padding: 7, overflowY: "auto" }} aria-label="Campus navigation">
            {navItems.map((item) => {
              const Icon = navIconByName(item.icon);
              const active = navItemActive(pathname, item);
              const count = badgeForItem(item);
              const content = (
                <>
                  <Icon size={15} color={active ? C.blue : C.textMuted} strokeWidth={1.7} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 400,
                      color: active ? C.text : C.textSub,
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
                  fontSize: 9,
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
                <div style={{ fontSize: 10, color: C.textMuted }}>{nav.roleBadge}</div>
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
                    : "linear-gradient(135deg,#4f46e5,#0891b2)",
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
                <div style={{ fontSize: 10, color: C.textMuted }}>{nav.roleBadge}</div>
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

        {/* ══ MAIN + RIGHT ═══════════════════════════════════════════════════ */}
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
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {abbr}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{agencyName}</div>
                  <div style={{ fontSize: 10.5, color: C.textMuted }}>
                    {roleSubtitle(userRole)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, color: C.textMuted }}>{clock.dateLine}</div>
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

            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              {error ? (
                <div
                  style={{
                    margin: "12px 16px 0",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#fca5a5",
                    fontSize: 12,
                  }}
                >
                  {error}
                </div>
              ) : null}

              {/* Hero */}
              <div style={{ position: "relative", height: 330, overflow: "hidden", flexShrink: 0 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${currentBg})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center top",
                    transition: "background-image 0.5s ease",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg,rgba(9,13,26,0.72) 0%,rgba(9,13,26,0.3) 55%,rgba(9,13,26,0.15) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg,rgba(9,13,26,0.15) 0%,rgba(9,13,26,0.05) 35%,rgba(9,13,26,0.72) 72%,rgba(9,13,26,1) 100%)",
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
                        textShadow: "0 2px 8px rgba(0,0,0,0.6)",
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
                      Here&apos;s what&apos;s happening across campus.
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
                          background: "rgba(13,19,33,0.88)",
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
                                color: C.textMuted,
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
                    background: "rgba(0,0,0,0.58)",
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
                      ACTIVE INCIDENTS
                    </span>
                    {incidentsHref ? (
                      <Link
                        href={incidentsHref}
                        style={{ fontSize: 11, color: C.blue, fontWeight: 500, textDecoration: "none" }}
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
                        No active incidents.
                      </div>
                    ) : (
                      openIncidents.slice(0, 4).map((inc) => {
                        const severity = incidentSeverity(inc.type);
                        return (
                          <div
                            key={inc.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 9,
                              padding: "9px 8px",
                              borderRadius: 7,
                              borderLeft: `3px solid ${C.red}`,
                              background: "rgba(239,68,68,0.05)",
                              marginBottom: 6,
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 7,
                                background: "rgba(239,68,68,0.12)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 15,
                                flexShrink: 0,
                              }}
                            >
                              {incidentEmoji(inc.type)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 4,
                                }}
                              >
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
                                  {mapIncidentType(inc.type)}
                                </div>
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "rgba(239,68,68,0.2)",
                                    color: "#fca5a5",
                                    border: "1px solid rgba(239,68,68,0.3)",
                                    flexShrink: 0,
                                  }}
                                >
                                  {severity}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: C.textMuted,
                                  marginTop: 2,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {inc.buildingLabel}
                                {inc.roomCode ? `, ${inc.roomCode}` : ""}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginTop: 5,
                                }}
                              >
                                <span style={{ fontSize: 10.5, color: C.textMuted }}>
                                  Reported: {formatReportedTime(inc.createdAt)} ·{" "}
                                  {formatTimeAgo(inc.updatedAt || inc.createdAt)}
                                </span>
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
                        color: C.textMuted,
                        gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      View all incidents <ArrowRight size={12} strokeWidth={1.7} />
                    </Link>
                  ) : null}
                </div>

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
                      RESPONDERS ON DUTY
                    </span>
                  </div>
                  <div style={{ padding: "0 8px 8px", minHeight: 120 }}>
                    {loading && onDuty.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>Loading…</div>
                    ) : onDuty.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>
                        No responders on duty.
                      </div>
                    ) : (
                      onDuty.slice(0, 6).map((r, i) => (
                        <div
                          key={r.userId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            padding: "7px 8px",
                            borderRadius: 7,
                            marginBottom: 4,
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div
                            style={{
                              width: 31,
                              height: 31,
                              borderRadius: "50%",
                              background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#fff",
                              flexShrink: 0,
                            }}
                          >
                            {r.initials || initialsFromName(r.displayName)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>
                              {r.displayName}
                            </div>
                            <div style={{ fontSize: 10.5, color: C.textMuted }}>
                              {r.role}
                              {r.zone ? ` · ${r.zone}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: C.green,
                              }}
                            />
                            <span style={{ fontSize: 10.5, color: C.green, fontWeight: 500 }}>
                              On Duty
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

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
                      CAMPUS ZONES
                    </span>
                    {zonesHref ? (
                      <Link
                        href={zonesHref}
                        style={{ fontSize: 11, color: C.blue, fontWeight: 500, textDecoration: "none" }}
                      >
                        View all
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ padding: "4px 10px 12px" }}>
                    <ZoneMap zoneLabels={zoneLabels} />
                  </div>
                </div>
              </div>

              {/* Operational Map */}
              <div style={{ padding: "0 16px 12px" }}>
                <div
                  style={{
                    ...card(),
                    overflow: "hidden",
                    height: 420,
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
                    theme={mapTheme}
                    onThemeChange={onMapThemeChange}
                    persistUserId={userId || null}
                    incidents={mapIncidents}
                    selectedIncidentId={selectedMapIncident}
                    onIncidentClick={(inc) => setSelectedMapIncident(inc.id)}
                    vertical="campus"
                    height="372px"
                    showLayerControl
                    defaultLayers={{
                      campusZones: true,
                      agencyZones: false,
                      counties: false,
                      activeIncidents: true,
                    }}
                  />
                </div>
              </div>

              {/* Quick actions + utilities */}
              <div style={{ padding: "4px 16px 20px" }}>
                {quickActions.length > 0 ? (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: C.textMuted,
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
                        key: "reports",
                        Icon: BarChart2,
                        label: "REPORTS",
                        desc: "View analytics, incident reports, and system activity.",
                        link: "View Reports",
                        color: C.red,
                        rgb: "239,68,68",
                        href: reportsHref,
                      },
                      {
                        key: "support",
                        Icon: Headphones,
                        label: "SUPPORT",
                        desc: "Get help from our team or access knowledge resources.",
                        link: "Get Support",
                        color: C.blue,
                        rgb: "59,130,246",
                        href: "mailto:support@rapidcortex.us",
                      },
                      {
                        key: "training",
                        Icon: GraduationCap,
                        label: "TRAINING",
                        desc: "Access training videos and user guides.",
                        link: "View Training",
                        color: "#8b5cf6",
                        rgb: "139,92,246",
                        href: "mailto:support@rapidcortex.us?subject=RC%20Campus%20training",
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
              {incidentsHref ? (
                <Link
                  href={incidentsHref}
                  style={{ fontSize: 11, color: C.blue, fontWeight: 500, textDecoration: "none" }}
                >
                  View all
                </Link>
              ) : null}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "12px 9px", fontSize: 12, color: C.textMuted }}>
                  No active incident alerts.
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
                            alignItems: "flex-start",
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
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          {n.desc}
                        </div>
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

              {isAdmin && checklist.length > 0 ? (
                <div style={card({ padding: "13px 13px", marginTop: 12 })}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 9,
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
                      CAMPUS SETUP CHECKLIST
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amber }}>
                      {checklistPct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 2,
                      marginBottom: 11,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${checklistPct}%`,
                        background: `linear-gradient(90deg,${C.blue},${C.green})`,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  {checklist.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "4.5px 0",
                        fontSize: 12,
                        color: item.done ? C.textSub : C.textMuted,
                        textDecoration: "none",
                      }}
                    >
                      {item.done ? (
                        <CheckCircle2 size={14} color={C.green} strokeWidth={1.8} />
                      ) : (
                        <Circle size={14} color="#334155" strokeWidth={1.8} />
                      )}
                      <span style={{ textDecoration: item.done ? "line-through" : "none" }}>
                        {item.label}
                      </span>
                    </Link>
                  ))}
                  {settingsHref ? (
                    <Link
                      href={settingsHref}
                      style={{
                        marginTop: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "7px",
                        borderRadius: 6,
                        background: "rgba(59,130,246,0.1)",
                        border: "1px solid rgba(59,130,246,0.2)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.blue,
                        gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      Go to Campus Setup <ArrowRight size={12} strokeWidth={1.7} />
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        {/* Background image modal */}
        {showModal ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.76)",
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
              aria-label="Change campus background"
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
                    Change Campus Background
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {agencyName} — stored locally for this browser (agency settings + S3 in
                    production)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: C.textMuted,
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
                      color: modalTab === tab.id ? C.blue : C.textMuted,
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
                    <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 14px" }}>
                      Select a preset background representing this campus.
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
                    <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 16px" }}>
                      Paste a direct image URL representing this campus.
                    </p>
                    <div style={{ display: "flex", gap: 9 }}>
                      <input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/campus-photo.jpg"
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
                          background: `url(${urlInput}) center/cover no-repeat, #1a2236`,
                          border: `1px solid ${C.border}`,
                        }}
                      />
                    ) : null}
                  </>
                ) : null}

                {modalTab === "upload" ? (
                  <>
                    <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 16px" }}>
                      Upload a photo of this campus. Stored locally in this browser only.
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
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
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
                    color: C.textMuted,
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

        {activeCameraIncident ? (
          <IncidentCameraPanel
            agencyId={agencyId}
            incident={activeCameraIncident}
            canDispatch={false}
            onClose={clearActiveCameraIncident}
            apiVertical="campus"
            locationNoun="Building"
            enableDispatchControls={false}
          />
        ) : null}
      </div>
    </HelpChrome>
  );
}

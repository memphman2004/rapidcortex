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
import type { VenueIncidentCameraSummary } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Headphones,
  Image as ImageIcon,
  Link2,
  MapPin,
  MessageSquare,
  Plus,
  Upload,
  Users,
  Video,
  Volume2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { HelpChrome } from "@/components/help/help-chrome";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { SiteSquareMark } from "@/components/brand/site-logo-link";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import { loadMapTheme, saveMapTheme } from "@/lib/maps/persisted-map-prefs";
import { venueIncidentsToMap } from "@/components/maps/map-incident-adapters";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
import { buildNavContext } from "@/lib/navigation/nav-context";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { navIconByName } from "@/lib/navigation/nav-icons";
import {
  getRoleNav,
  type NavItem,
  type RoleNav,
} from "@/lib/navigation/role-nav";
import { useNavBadgeCounts } from "@/lib/navigation/use-nav-badge-counts";
import { fetchVenueSectionCameras } from "@/lib/venue/venue-camera-api";
import { isVenueGuestServicesRole } from "@/lib/venue/venue-guest-services";
import { canVenueSupervisorOps } from "@/lib/vertical/supervisor-access";
import {
  IncidentCameraPanel,
  type VenueActiveIncidentPanel,
} from "./IncidentCameraPanel";
import { VENUE_DASHBOARD_FONT_FAMILY } from "./venue-dashboard-font";
import { VenueGuestServicesDisclaimer } from "./venue-guest-services-disclaimer";
import {
  CreateVenueIncidentModal,
  NotifyStaffModal,
  VenueBroadcastModal,
} from "./venue-ops-modals";
import {
  useVenueThreatLevel,
  type VenueThreatLevel,
} from "./venue-threat-strip";
import {
  formatVenueTimeAgo,
  mapVenueIncidentType,
  useVenueOpsData,
} from "./use-venue-ops-data";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import { FIXTURE_ZONES } from "@/app/venue/[venueCode]/_lib/venue-fixtures";
import {
  consoleBgStorageKey,
  loadConsoleBg,
  removeLocalStorage,
  writeAccountAvatar,
  writeLocalStorage,
} from "@/lib/account/account-picture";
import { C } from "@/lib/theme/rc-theme-tokens";

// ─── Design tokens (theme-aware CSS vars via C) ───────────────────────────────

const CREST_BG = "var(--rc-red-deep)";

const DEFAULT_VENUE_BG =
  "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1920&q=80";

const PRESETS = [
  {
    label: "Football Stadium",
    fallback: "#3d1a0a",
    url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Basketball Arena",
    fallback: "#1a1a3d",
    url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Concert Venue",
    fallback: "#1a0a2a",
    url: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Convention Center",
    fallback: "#1a1a3d",
    url: "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Baseball Stadium",
    fallback: "#0a1a2a",
    url: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Soccer Stadium",
    fallback: "#0a1a0a",
    url: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80",
  },
] as const;

const AVATAR_COLORS = ["#b45309", "#0891b2", "#7c3aed", "#0f766e", "#92400e", "#be185d"];

const nColors = {
  error: { dot: C.red, bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.22)" },
  info: { dot: C.blue, bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.22)" },
  warning: { dot: C.amber, bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.22)" },
  success: { dot: C.green, bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.22)" },
} as const;

type NotifType = keyof typeof nColors;

/** Mockup labels mapped onto existing VenueThreatLevel values. */
const THREAT_UI: {
  id: VenueThreatLevel;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    id: "secure",
    label: "SECURE",
    color: "#10b981",
    bg: "rgba(16,185,129,0.15)",
    border: "rgba(16,185,129,0.3)",
  },
  {
    id: "elevated",
    label: "ELEVATED",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.3)",
  },
  {
    id: "high_alert",
    label: "HIGH",
    color: "#f97316",
    bg: "rgba(249,115,22,0.15)",
    border: "rgba(249,115,22,0.3)",
  },
  {
    id: "lockdown",
    label: "CRITICAL",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.3)",
  },
];

function card(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: "10px",
    ...extra,
  };
}

function venueBgLegacyKey(agencyId: string): string {
  return `rc-venue-bg:${agencyId}`;
}

function venueAbbr(venueCode: string): string {
  const cleaned = venueCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
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
    case "VENUE_ADMIN":
      return "Venue Administration";
    case "VENUE_SUPERVISOR":
      return "Event Security";
    case "VENUE_SECURITY":
      return "Venue Security";
    case "VENUE_OPERATOR":
      return "Venue Operations";
    case "VENUE_GUEST_SERVICES":
      return "Guest Services";
    default:
      return "Event Security";
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

function incidentEmoji(type: VenueIncident["type"]): string {
  switch (type) {
    case "medical":
      return "🏥";
    case "security":
      return "🛡️";
    case "lost_person":
      return "🧒";
    case "maintenance":
      return "🔧";
    case "guest_services":
      return "🎫";
    default:
      return "📋";
  }
}

function incidentSeverity(type: VenueIncident["type"]): "HIGH" | "MEDIUM" | "LOW" {
  if (type === "security" || type === "medical") return "HIGH";
  if (type === "lost_person") return "MEDIUM";
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

type SectionMapStatus = "clear" | "active" | "multiple";

type SectionMapZone = {
  /** Canonical zone/section code used for status lookup (e.g. S101, G-A, FIELD). */
  id: string;
  /** Short label rendered on the tile. */
  label: string;
};

function normalizeZoneKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

function compactZoneKey(raw: string): string {
  return normalizeZoneKey(raw).replace(/[\s_-]+/g, "");
}

/** Match an incident location string to a known zone id, if any. */
function matchZoneId(
  raw: string,
  zones: SectionMapZone[],
): string | null {
  const key = normalizeZoneKey(raw);
  const compact = compactZoneKey(raw);
  if (!key) return null;

  for (const z of zones) {
    const zKey = normalizeZoneKey(z.id);
    const zLabel = normalizeZoneKey(z.label);
    if (key === zKey || key === zLabel) return z.id;
    if (compact && compact === compactZoneKey(z.id)) return z.id;
    if (compact && compact === compactZoneKey(z.label)) return z.id;
  }

  // "Section 101" / "101" → S101 when that zone exists
  const digits = raw.match(/\d{2,4}/)?.[0];
  if (digits) {
    const asS = `S${digits}`;
    const hit =
      zones.find((z) => normalizeZoneKey(z.id) === asS) ??
      zones.find((z) => normalizeZoneKey(z.id) === digits);
    if (hit) return hit.id;
  }

  return null;
}

function statusFromCount(count: number): SectionMapStatus {
  if (count >= 2) return "multiple";
  if (count === 1) return "active";
  return "clear";
}

function layoutRingPositions(
  count: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

function StadiumMap({
  zones,
  statusBySection,
}: {
  zones: SectionMapZone[];
  statusBySection: Record<string, SectionMapStatus>;
}) {
  const SC = {
    clear: {
      fill: "rgba(16,185,129,0.12)",
      stroke: "#10b981",
      text: "#6ee7b7",
      dot: "#10b981",
    },
    active: {
      fill: "rgba(245,158,11,0.18)",
      stroke: "#f59e0b",
      text: "#fcd34d",
      dot: "#f59e0b",
    },
    multiple: {
      fill: "rgba(239,68,68,0.18)",
      stroke: "#ef4444",
      text: "#fca5a5",
      dot: "#ef4444",
    },
  } as const;

  const n = zones.length;
  // Widen canvas slightly when many zones so labels stay readable.
  const viewW = n > 14 ? 280 : 240;
  const viewH = n > 14 ? 220 : 190;
  const cx = viewW / 2;
  const cy = (viewH - 18) / 2;
  const rx = Math.min(viewW / 2 - 28, n > 14 ? 118 : 96);
  const ry = Math.min(cy - 22, n > 14 ? 88 : 76);
  const positions = layoutRingPositions(n, cx, cy, rx, ry);
  const fontSize = n > 16 ? 6.5 : n > 12 ? 7.5 : 9;
  const boxH = n > 16 ? 18 : 22;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <rect width={viewW} height={viewH} fill="#060810" rx="6" />
      {[40, 80, 120, 160, 200, 240].filter((x) => x < viewW).map((x) => (
        <line
          key={`v${x}`}
          x1={x}
          y1="0"
          x2={x}
          y2={viewH}
          stroke="rgba(255,255,255,0.025)"
          strokeWidth="1"
        />
      ))}
      {[47, 95, 143, 191].filter((y) => y < viewH).map((y) => (
        <line
          key={`h${y}`}
          x1="0"
          y1={y}
          x2={viewW}
          y2={y}
          stroke="rgba(255,255,255,0.025)"
          strokeWidth="1"
        />
      ))}

      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="rgba(20,10,5,0.5)"
        stroke="rgba(245,158,11,0.1)"
        strokeWidth="1"
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={Math.min(52, rx * 0.55)}
        ry={Math.min(37, ry * 0.5)}
        fill="#061208"
        stroke="#0f3a12"
        strokeWidth="1.5"
      />
      <line
        x1={cx}
        y1={cy - 37}
        x2={cx}
        y2={cy + 37}
        stroke="#0d2a0e"
        strokeWidth="0.8"
      />
      <line
        x1={cx - 52}
        y1={cy}
        x2={cx + 52}
        y2={cy}
        stroke="#0d2a0e"
        strokeWidth="0.8"
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={28}
        ry={18}
        fill="none"
        stroke="#0d2a0e"
        strokeWidth="0.8"
      />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill="#1a5020"
        fontSize="9"
        fontWeight="700"
        fontFamily="inherit"
      >
        FIELD
      </text>
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        fill="#0f3010"
        fontSize="7"
        fontFamily="inherit"
      >
        EVENT AREA
      </text>

      {zones.map((zone, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const status = statusBySection[zone.id] ?? "clear";
        const sc = SC[status];
        const label = zone.label.length > 7 ? zone.label.slice(0, 6) : zone.label;
        const boxW = Math.max(34, 10 + label.length * (fontSize * 0.62) + 12);
        return (
          <g key={zone.id}>
            <title>{`${zone.label}: ${status}`}</title>
            <rect
              x={pos.x - boxW / 2}
              y={pos.y - boxH / 2}
              width={boxW}
              height={boxH}
              rx="4"
              fill={sc.fill}
              stroke={sc.stroke}
              strokeWidth="1.2"
            />
            <text
              x={pos.x - 4}
              y={pos.y + fontSize * 0.35}
              textAnchor="middle"
              fill={sc.text}
              fontSize={fontSize}
              fontWeight="700"
              fontFamily="inherit"
            >
              {label}
            </text>
            <circle
              cx={pos.x + boxW / 2 - 7}
              cy={pos.y - 1}
              r="3.5"
              fill={sc.dot}
            />
          </g>
        );
      })}

      <g>
        <circle cx="14" cy={viewH - 10} r="3.5" fill="#10b981" />
        <text x="21" y={viewH - 7} fill="#3d3460" fontSize="7.5" fontFamily="inherit">
          Clear
        </text>
        <circle cx="52" cy={viewH - 10} r="3.5" fill="#f59e0b" />
        <text x="59" y={viewH - 7} fill="#3d3460" fontSize="7.5" fontFamily="inherit">
          Active
        </text>
        <circle cx="93" cy={viewH - 10} r="3.5" fill="#ef4444" />
        <text x="100" y={viewH - 7} fill="#3d3460" fontSize="7.5" fontFamily="inherit">
          Multiple
        </text>
      </g>
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type VenueConsoleHomeProps = {
  agencyId: string;
  venueCode: string;
  venueName: string;
  displayName: string;
  userEmail?: string;
  userRole?: string;
  /** Cognito user id — scopes welcome image per account. */
  userId?: string;
};

type ModalTab = "presets" | "url" | "upload";

type QuickActionDef =
  | {
      key: string;
      kind: "link";
      label: string;
      href: string;
      Icon: LucideIcon;
      bg: string;
      color: string;
      bdr: string;
    }
  | {
      key: string;
      kind: "button";
      label: string;
      onClick: () => void;
      Icon: LucideIcon;
      bg: string;
      color: string;
      bdr: string;
      emergency?: boolean;
    };

// ─── Main ─────────────────────────────────────────────────────────────────────

export function VenueConsoleHome(props: VenueConsoleHomeProps) {
  return (
    <ThemeProvider storageKey="rc-theme-venue">
      <VenueConsoleHomeInner {...props} />
    </ThemeProvider>
  );
}

function VenueConsoleHomeInner({
  agencyId,
  venueCode,
  venueName,
  displayName,
  userEmail,
  userRole,
  userId = "",
}: VenueConsoleHomeProps) {
  const pathname = usePathname() ?? "";
  const codeUpper = venueCode.toUpperCase();
  const abbr = venueAbbr(codeUpper);
  const canSupervisor = canVenueSupervisorOps(userRole);
  const isGuestServices = isVenueGuestServicesRole(userRole);

  const navRole = isRcInternalOperator(userRole ?? "")
    ? "VENUE_ADMIN"
    : (userRole ?? "VENUE_SECURITY");

  const nav = useMemo(() => {
    const ctx = buildNavContext({ agencyId }, undefined);
    return filterRoleNavByFeatures(
      getRoleNav(navRole, { ...ctx, venueCode: codeUpper }),
    );
  }, [agencyId, navRole, codeUpper]);

  const navItems = useMemo(() => flattenNavItems(nav), [nav]);
  const badgeCounts = useNavBadgeCounts(userRole);

  const {
    loading,
    error,
    stats,
    sections,
    onDuty,
    incidents,
    refreshAll,
  } = useVenueOpsData(agencyId);

  const { level: threatLevel, setLevel: setThreatLevel } = useVenueThreatLevel(agencyId);
  const threat = THREAT_UI.find((t) => t.id === threatLevel) ?? THREAT_UI[0]!;

  const [now, setNow] = useState(() => new Date());
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("presets");
  const [urlInput, setUrlInput] = useState("");
  const [showThreat, setShowThreat] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [activeIncident, setActiveIncident] = useState<VenueActiveIncidentPanel | null>(null);
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
    setMapTheme(loadMapTheme(userId, "venue", "dark"));
  }, [userId]);

  const onMapThemeChange = useCallback(
    (next: "dark" | "light") => {
      setMapTheme(next);
      saveMapTheme(userId || null, "venue", next);
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
        keyed: consoleBgStorageKey("venue", userId, agencyId),
        legacyKey: venueBgLegacyKey(agencyId),
      }),
    );
  }, [agencyId, userId]);

  const currentBg = customBg ?? DEFAULT_VENUE_BG;
  const hasCustomBg = Boolean(customBg);
  const clock = formatClock(now);

  const applyBg = useCallback(
    (url: string) => {
      setCustomBg(url);
      if (userId) {
        writeLocalStorage(consoleBgStorageKey("venue", userId, agencyId), url);
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
      removeLocalStorage(consoleBgStorageKey("venue", userId, agencyId));
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

  const handleIncidentCreated = useCallback(
    async (data: Record<string, unknown>) => {
      const incidentId = String(data.incidentId ?? "");
      const section = String(data.section ?? "");
      if (!incidentId || !section) return;

      let cameras = (data.cameras as VenueIncidentCameraSummary[] | undefined) ?? [];
      if (cameras.length === 0) {
        try {
          cameras = await fetchVenueSectionCameras(agencyId, section, 2);
        } catch {
          cameras = [];
        }
      }

      setActiveIncident({
        incidentId,
        section,
        reportType: String(data.reportType ?? "incident"),
        location: String(data.location ?? `Section ${section}`),
        cameras,
        createdAt: String(data.createdAt ?? new Date().toISOString()),
      });
    },
    [agencyId],
  );

  useAgencyWebSocket((msg) => {
    if (msg.type === "incident:created") {
      void handleIncidentCreated(msg.data);
    }
    if (msg.type === "camera:offline" && activeIncident) {
      const cameraId = String(msg.data.cameraId ?? "");
      const msgSections = (msg.data.sections as string[] | undefined) ?? [];
      if (!cameraId || !msgSections.includes(activeIncident.section)) return;
      void (async () => {
        const replacements = await fetchVenueSectionCameras(agencyId, activeIncident.section, 10);
        setActiveIncident((prev) => {
          if (!prev) return prev;
          const nextCameras = prev.cameras.map((cam) => {
            if (cam.cameraId !== cameraId) return cam;
            const replacement = replacements.find(
              (r) => r.cameraId !== cameraId && !prev.cameras.some((c) => c.cameraId === r.cameraId),
            );
            return replacement ?? cam;
          });
          return { ...prev, cameras: nextCameras.filter(Boolean) };
        });
      })();
    }
  });

  const openIncidents = useMemo(
    () =>
      incidents.filter(
        (i) => i.status === "open" || i.status === "assigned" || i.status === "responding",
      ),
    [incidents],
  );

  const mapIncidents = useMemo(() => venueIncidentsToMap(openIncidents), [openIncidents]);

  const mapZones = useMemo((): SectionMapZone[] => {
    if (sections.length > 0) {
      return sections.map((s) => ({
        id: s.sectionId,
        label: s.sectionId || s.sectionName,
      }));
    }
    const fixtures = FIXTURE_ZONES.filter(
      (z) => !codeUpper || z.venueCode.toUpperCase() === codeUpper,
    );
    const source = fixtures.length > 0 ? fixtures : FIXTURE_ZONES;
    return source.map((z) => ({ id: z.code, label: z.code }));
  }, [sections, codeUpper]);

  const sectionIncidentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const z of mapZones) counts.set(z.id, 0);

    for (const s of sections) {
      const id =
        mapZones.find((z) => normalizeZoneKey(z.id) === normalizeZoneKey(s.sectionId))?.id ??
        s.sectionId;
      if (!counts.has(id)) counts.set(id, 0);
      counts.set(id, Math.max(counts.get(id) ?? 0, s.incidentCount ?? 0));
    }

    const live = new Map<string, number>();
    for (const inc of openIncidents) {
      const matched =
        matchZoneId(inc.zoneCode, mapZones) ??
        matchZoneId(inc.zoneLabel, mapZones) ??
        (inc.qrLocationName ? matchZoneId(inc.qrLocationName, mapZones) : null);
      if (!matched) continue;
      live.set(matched, (live.get(matched) ?? 0) + 1);
    }
    for (const [id, n] of live) {
      counts.set(id, Math.max(counts.get(id) ?? 0, n));
    }

    // When dashboard sections API is empty, mirror fixture zone incident counts
    // so overview colors match the Zones table.
    if (sections.length === 0) {
      for (const z of FIXTURE_ZONES) {
        if (codeUpper && z.venueCode.toUpperCase() !== codeUpper) continue;
        const id =
          mapZones.find((m) => normalizeZoneKey(m.id) === normalizeZoneKey(z.code))?.id ??
          z.code;
        if (!counts.has(id)) continue;
        counts.set(id, Math.max(counts.get(id) ?? 0, z.activeIncidents));
      }
    }

    return counts;
  }, [mapZones, sections, openIncidents, codeUpper]);

  const statusBySection = useMemo(() => {
    const out: Record<string, SectionMapStatus> = {};
    for (const z of mapZones) {
      out[z.id] = statusFromCount(sectionIncidentCounts.get(z.id) ?? 0);
    }
    return out;
  }, [mapZones, sectionIncidentCounts]);

  const sectionSummary = useMemo(() => {
    const total = mapZones.length;
    let clear = 0;
    let active = 0;
    let multiple = 0;
    for (const z of mapZones) {
      const n = sectionIncidentCounts.get(z.id) ?? 0;
      if (n >= 2) multiple += 1;
      else if (n === 1) active += 1;
      else clear += 1;
    }
    return { total, clear, active, multiple };
  }, [mapZones, sectionIncidentCounts]);

  const kpiIncidents = stats?.activeIncidents ?? openIncidents.length;
  const kpiStaff = stats?.securityOnDuty ?? onDuty.length;
  const kpiSections =
    stats?.sectionsMonitored != null
      ? `${stats.sectionsMonitored} / ${stats.sectionsMonitored}`
      : sections.length > 0
        ? `${sections.length} / ${sections.length}`
        : "—";
  const kpiGuestReports = stats?.guestReportsToday ?? 0;

  const incidentsHref = findNavHref(navItems, "incidents");
  const zonesHref = findNavHref(navItems, "zones");
  const camerasHref = findNavHref(navItems, "cameras");
  const guestHref = findNavHref(navItems, "guest", "reports");
  const reportsHref = findNavHref(navItems, "reports", "analytics");
  const staffHref = findNavHref(navItems, "staff");

  const quickActions = useMemo(() => {
    const tile = {
      bg: "color-mix(in srgb, var(--rc-blue) 14%, var(--rc-surface))",
      color: "var(--rc-text-primary)",
      bdr: "var(--rc-border)",
    };
    const warn = {
      bg: "color-mix(in srgb, var(--rc-amber, #f59e0b) 16%, var(--rc-surface))",
      color: "var(--rc-text-primary)",
      bdr: "var(--rc-border)",
    };
    const danger = {
      bg: "color-mix(in srgb, var(--rc-red, #ef4444) 16%, var(--rc-surface))",
      color: "var(--rc-text-primary)",
      bdr: "var(--rc-border)",
    };
    const actions: QuickActionDef[] = [];
    if (canSupervisor) {
      actions.push({
        key: "new-incident",
        kind: "button",
        label: "New Incident",
        onClick: () => setCreateOpen(true),
        Icon: Plus,
        ...warn,
      });
    }
    if (zonesHref) {
      actions.push({
        key: "zones",
        kind: "link",
        label: "Section Map",
        href: zonesHref,
        Icon: MapPin,
        ...tile,
      });
    }
    if (canSupervisor) {
      actions.push({
        key: "notify",
        kind: "button",
        label: "Notify Staff",
        onClick: () => setNotifyOpen(true),
        Icon: Volume2,
        ...warn,
      });
    }
    if (camerasHref) {
      actions.push({
        key: "cameras",
        kind: "link",
        label: "Live Cameras",
        href: camerasHref,
        Icon: Video,
        ...tile,
      });
    }
    if (guestHref) {
      actions.push({
        key: "guest",
        kind: "link",
        label: "Guest Reports",
        href: guestHref,
        Icon: MessageSquare,
        ...tile,
      });
    }
    if (canSupervisor) {
      actions.push({
        key: "broadcast",
        kind: "button",
        label: "Emergency Broadcast",
        onClick: () => setBroadcastOpen(true),
        Icon: Zap,
        ...danger,
        emergency: true,
      });
    }
    return actions;
  }, [canSupervisor, zonesHref, camerasHref, guestHref]);

  const notifications = useMemo(() => {
    return openIncidents.slice(0, 8).map((inc) => ({
      id: inc.id,
      type: "error" as NotifType,
      title: `${mapVenueIncidentType(inc.type)}: ${inc.zoneLabel || inc.zoneCode}`,
      desc: inc.description?.slice(0, 80) || "Active venue incident",
      time: formatVenueTimeAgo(inc.updatedAt || inc.createdAt),
      href: incidentsHref ? `${incidentsHref}` : undefined,
    }));
  }, [openIncidents, incidentsHref]);

  const openIncidentCount = badgeCounts.openIncidents ?? openIncidents.length;

  const badgeForItem = (item: NavItem): number | null => {
    if (!item.badge || item.badge.type !== "count") return null;
    if (item.badge.key === "openIncidents") {
      return openIncidentCount > 0 ? openIncidentCount : null;
    }
    if (item.badge.key === "openGuestReports") {
      const n = badgeCounts.openGuestReports ?? kpiGuestReports;
      return n > 0 ? n : null;
    }
    const n = badgeCounts[item.badge.key] ?? 0;
    return n > 0 ? n : null;
  };

  const setThreatIfAllowed = (next: VenueThreatLevel) => {
    if (!canSupervisor) return;
    setThreatLevel(next);
    setShowThreat(false);
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
      label: "SECURITY ON DUTY",
      value: loading ? "…" : kpiStaff,
      color: C.text,
      icon: <Users size={17} color={C.amber} strokeWidth={1.7} />,
      iconBg: "rgba(245,158,11,0.15)",
      linkLabel: "View staff roster",
      href: staffHref,
    },
    {
      label: "SECTIONS MONITORED",
      value: loading ? "…" : kpiSections,
      color: C.text,
      icon: <MapPin size={17} color={C.green} strokeWidth={1.7} />,
      iconBg: "rgba(16,185,129,0.15)",
      linkLabel: "View section status",
      href: zonesHref,
    },
    {
      label: "GUEST REPORTS TODAY",
      value: loading ? "…" : kpiGuestReports,
      color: kpiGuestReports > 5 ? C.amber : C.text,
      icon: <MessageSquare size={17} color={C.blue} strokeWidth={1.7} />,
      iconBg: "rgba(59,130,246,0.15)",
      linkLabel: "View guest reports",
      href: guestHref,
    },
  ];

  return (
    <HelpChrome role={userRole ?? "VENUE_SECURITY"}>
      <div
        ref={rootRef}
        data-theme="dark"
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: C.bg,
          fontFamily: VENUE_DASHBOARD_FONT_FAMILY,
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
                  RAPID <span style={{ color: C.amber }}>CORTEX</span>
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: C.amber,
                    letterSpacing: "2.5px",
                    marginTop: 2,
                  }}
                >
                  VENUE
                </div>
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, padding: 7, overflowY: "auto" }} aria-label="Venue navigation">
            {navItems.map((item) => {
              const Icon = navIconByName(item.icon);
              const active = navItemActive(pathname, item);
              const count = badgeForItem(item);
              const content = (
                <>
                  <Icon size={15} color={active ? C.amber : C.textSub} strokeWidth={1.7} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 400,
                      color: active ? C.text : "#7c6fa0",
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
                background: active ? "rgba(245,158,11,0.1)" : "transparent",
                borderLeft: active ? `2px solid ${C.amber}` : "2px solid transparent",
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
                  {venueName}
                </div>
                <div style={{ fontSize: 10, color: C.textSub }}>{roleSubtitle(userRole)}</div>
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
                    : "linear-gradient(135deg,#92400e,#b45309)",
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{venueName}</div>
                  <div style={{ fontSize: 10.5, color: C.textSub }}>Venue Operations Center</div>
                </div>

                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => canSupervisor && setShowThreat((v) => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      background: threat.bg,
                      border: `1px solid ${threat.border}`,
                      borderRadius: 6,
                      cursor: canSupervisor ? "pointer" : "default",
                      fontFamily: "inherit",
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={showThreat}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: threat.color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: threat.color,
                        letterSpacing: "0.8px",
                      }}
                    >
                      {threat.label}
                    </span>
                    {canSupervisor ? <ChevronDown size={11} color={threat.color} /> : null}
                  </button>

                  {showThreat && canSupervisor ? (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        width: 160,
                        background: "#0a0818",
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
                          SET THREAT LEVEL
                        </span>
                      </div>
                      {THREAT_UI.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setThreatIfAllowed(t.id)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: t.id === threatLevel ? t.bg : "transparent",
                            border: "none",
                            borderLeft: `2px solid ${t.id === threatLevel ? t.color : "transparent"}`,
                            fontFamily: "inherit",
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: t.color,
                            }}
                          />
                          <span style={{ fontSize: 12, fontWeight: 600, color: t.color }}>
                            {t.label}
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
              onClick={() => showThreat && setShowThreat(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && showThreat) setShowThreat(false);
              }}
              role="presentation"
            >
              {isGuestServices ? (
                <div style={{ padding: "10px 16px 0" }}>
                  <VenueGuestServicesDisclaimer />
                </div>
              ) : null}

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
                      "linear-gradient(90deg,rgba(9,9,15,0.75) 0%,rgba(9,9,15,0.32) 55%,rgba(9,9,15,0.15) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg,rgba(9,9,15,0.15) 0%,rgba(9,9,15,0.05) 32%,rgba(9,9,15,0.72) 72%,rgba(9,9,15,1) 100%)",
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
                        textShadow: "0 2px 8px rgba(0,0,0,0.65)",
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
                      Here&apos;s what&apos;s happening at {venueName}.
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
                          background: "rgba(14,12,26,0.9)",
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
                              color: C.amber,
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
                        style={{
                          fontSize: 11,
                          color: C.amber,
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
                        No active incidents.
                      </div>
                    ) : (
                      openIncidents.slice(0, 4).map((inc) => {
                        const severity = incidentSeverity(inc.type);
                        const isHigh = severity === "HIGH";
                        return (
                          <div
                            key={inc.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 9,
                              padding: "9px 8px",
                              borderRadius: 7,
                              borderLeft: `3px solid ${isHigh ? C.red : C.amber}`,
                              background: isHigh
                                ? "rgba(239,68,68,0.05)"
                                : "rgba(245,158,11,0.05)",
                              marginBottom: 6,
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 7,
                                background: isHigh
                                  ? "rgba(239,68,68,0.12)"
                                  : "rgba(245,158,11,0.12)",
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
                                  {mapVenueIncidentType(inc.type)}
                                </div>
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: isHigh
                                      ? "rgba(239,68,68,0.2)"
                                      : "rgba(245,158,11,0.2)",
                                    color: isHigh ? "#fca5a5" : "#fcd34d",
                                    border: `1px solid ${
                                      isHigh ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"
                                    }`,
                                    flexShrink: 0,
                                  }}
                                >
                                  {severity}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: C.textSub,
                                  marginTop: 2,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {inc.zoneLabel || inc.zoneCode}
                                {inc.qrLocationName ? ` · ${inc.qrLocationName}` : ""}
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
                                  {formatVenueTimeAgo(inc.updatedAt || inc.createdAt)}
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
                        color: C.textSub,
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
                      SECURITY ON DUTY
                    </span>
                    {staffHref ? (
                      <Link
                        href={staffHref}
                        style={{
                          fontSize: 11,
                          color: C.amber,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        View all
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ padding: "0 8px 8px", minHeight: 120 }}>
                    {loading && onDuty.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>Loading…</div>
                    ) : onDuty.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: C.textMuted }}>
                        No security on duty.
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
                            <div style={{ fontSize: 10.5, color: C.textSub }}>
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
                  {staffHref ? (
                    <Link
                      href={staffHref}
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
                      View all staff <ArrowRight size={12} strokeWidth={1.7} />
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
                      SECTION STATUS
                    </span>
                    {zonesHref ? (
                      <Link
                        href={zonesHref}
                        style={{
                          fontSize: 11,
                          color: C.amber,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        View all
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ padding: "4px 10px 12px" }}>
                    <StadiumMap zones={mapZones} statusBySection={statusBySection} />
                  </div>
                </div>
              </div>

              {/* Operational Map */}
              <div style={{ padding: "0 16px 12px" }}>
                <div
                  style={{
                    ...card(),
                    overflow: "hidden",
                    height: 400,
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
                  <div style={{ height: 420, borderRadius: 8, overflow: "hidden" }}>
                    <RapidCortexMap
                      theme={mapTheme}
                      onThemeChange={onMapThemeChange}
                      persistUserId={userId || null}
                      incidents={mapIncidents}
                      selectedIncidentId={selectedMapIncident}
                      onIncidentClick={(inc) => setSelectedMapIncident(inc.id)}
                      vertical="venue"
                      height="420px"
                      showLayerControl
                      defaultLayers={{
                        venueZones: true,
                        agencyZones: false,
                        counties: false,
                        activeIncidents: true,
                      }}
                    />
                  </div>
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
                        const inner = (
                          <>
                            {a.kind === "button" && a.emergency ? (
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
                              size={a.kind === "button" && a.emergency ? 20 : 19}
                              color={a.color}
                              strokeWidth={a.kind === "button" && a.emergency ? 2 : 1.7}
                              style={{ position: "relative" }}
                            />
                            <span
                              style={{
                                fontSize: a.kind === "button" && a.emergency ? 11 : 10.5,
                                fontWeight: a.kind === "button" && a.emergency ? 700 : 600,
                                color: a.color,
                                textAlign: "center",
                                lineHeight: 1.3,
                                position: "relative",
                              }}
                            >
                              {a.label}
                            </span>
                          </>
                        );
                        const style: CSSProperties = {
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
                          fontFamily: "inherit",
                          color: "inherit",
                        };
                        if (a.kind === "link") {
                          return (
                            <Link key={a.key} href={a.href} style={style}>
                              {inner}
                            </Link>
                          );
                        }
                        return (
                          <button key={a.key} type="button" onClick={a.onClick} style={style}>
                            {inner}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {(
                    [
                      {
                        key: "cameras",
                        Icon: Video,
                        label: "CAMERAS",
                        desc: "View live camera feeds for all sections and gates.",
                        link: "Open Cameras",
                        color: "#8b5cf6",
                        rgb: "139,92,246",
                        href: camerasHref,
                      },
                      {
                        key: "reports",
                        Icon: BarChart2,
                        label: "REPORTS",
                        desc: "Incident reports, guest reports, and shift analytics.",
                        link: "View Reports",
                        color: C.amber,
                        rgb: "245,158,11",
                        href: reportsHref ?? guestHref,
                      },
                      {
                        key: "support",
                        Icon: Headphones,
                        label: "SUPPORT",
                        desc: "Get help from our team or access the knowledge base.",
                        link: "Get Support",
                        color: C.blue,
                        rgb: "59,130,246",
                        href: "mailto:support@rapidcortex.us",
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
                  style={{
                    fontSize: 11,
                    color: C.amber,
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
                        <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
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

              {/* Threat Level Panel */}
              <div style={card({ padding: "13px 13px", marginTop: 12 })}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 11,
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
                    THREAT LEVEL
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 8px",
                      background: threat.bg,
                      border: `1px solid ${threat.border}`,
                      borderRadius: 5,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: threat.color,
                      }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 700, color: threat.color }}>
                      {threat.label}
                    </span>
                  </div>
                </div>
                {THREAT_UI.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThreatIfAllowed(t.id)}
                    disabled={!canSupervisor}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "8px 10px",
                      borderRadius: 6,
                      marginBottom: 4,
                      cursor: canSupervisor ? "pointer" : "default",
                      background: t.id === threatLevel ? t.bg : "rgba(255,255,255,0.02)",
                      border: `1px solid ${t.id === threatLevel ? t.border : C.border}`,
                      fontFamily: "inherit",
                      opacity: canSupervisor || t.id === threatLevel ? 1 : 0.7,
                    }}
                  >
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: t.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: t.id === threatLevel ? 700 : 400,
                        color: t.id === threatLevel ? t.color : C.textSub,
                      }}
                    >
                      {t.label}
                    </span>
                    {t.id === threatLevel ? (
                      <CheckCircle2
                        size={13}
                        color={t.color}
                        strokeWidth={2}
                        style={{ marginLeft: "auto" }}
                      />
                    ) : null}
                  </button>
                ))}
                {canSupervisor ? (
                  <button
                    type="button"
                    onClick={() => setBroadcastOpen(true)}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontFamily: "inherit",
                    }}
                  >
                    <Zap size={13} color={C.red} strokeWidth={2} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fca5a5" }}>
                      Emergency Broadcast
                    </span>
                    <ArrowRight
                      size={12}
                      color="#fca5a5"
                      strokeWidth={2}
                      style={{ marginLeft: "auto" }}
                    />
                  </button>
                ) : null}
              </div>

              {/* Section Status Summary */}
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
                    SECTION SUMMARY
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amber }}>
                    {sectionSummary.total} Total
                  </span>
                </div>
                {(
                  [
                    {
                      label: "Clear",
                      count: sectionSummary.clear,
                      color: C.green,
                      bar: "rgba(16,185,129,0.6)",
                    },
                    {
                      label: "Active Incident",
                      count: sectionSummary.active,
                      color: C.amber,
                      bar: "rgba(245,158,11,0.6)",
                    },
                    {
                      label: "Multiple Incidents",
                      count: sectionSummary.multiple,
                      color: C.red,
                      bar: "rgba(239,68,68,0.6)",
                    },
                  ] as const
                ).map((row) => (
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
                      <span style={{ fontSize: 11, fontWeight: 700, color: row.color }}>
                        {row.count}
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
                          width: `${
                            sectionSummary.total > 0
                              ? (row.count / sectionSummary.total) * 100
                              : 0
                          }%`,
                          background: row.bar,
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

        {/* Background image modal */}
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
              aria-label="Change venue background"
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
                    Change Venue Background
                  </div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
                    {venueName} — stored locally for this browser
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
                      borderBottom: `2px solid ${modalTab === tab.id ? C.amber : "transparent"}`,
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: modalTab === tab.id ? 600 : 400,
                      color: modalTab === tab.id ? C.amber : C.textSub,
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
                      Select a preset background representing this venue type.
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
                              border: `2px solid ${isActive ? C.amber : C.border}`,
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
                                    background: C.amber,
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
                      Paste a direct image URL representing this venue.
                    </p>
                    <div style={{ display: "flex", gap: 9 }}>
                      <input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/stadium-photo.jpg"
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
                          background: "#92400e",
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
                          background: `url(${urlInput}) center/cover no-repeat, #1a0e0a`,
                          border: `1px solid ${C.border}`,
                        }}
                      />
                    ) : null}
                  </>
                ) : null}

                {modalTab === "upload" ? (
                  <>
                    <p style={{ fontSize: 12, color: C.textSub, margin: "0 0 16px" }}>
                      Upload a photo of this venue. Stored locally in this browser only.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: "2px dashed rgba(245,158,11,0.3)",
                        borderRadius: 10,
                        padding: "38px 20px",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "rgba(245,158,11,0.04)",
                        width: "100%",
                        fontFamily: "inherit",
                        color: "inherit",
                      }}
                    >
                      <Upload
                        size={26}
                        color={C.amber}
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

        {createOpen ? (
          <CreateVenueIncidentModal
            venueCode={codeUpper}
            onClose={() => setCreateOpen(false)}
            onCreated={() => void refreshAll()}
          />
        ) : null}
        {notifyOpen ? (
          <NotifyStaffModal agencyId={agencyId} onClose={() => setNotifyOpen(false)} />
        ) : null}
        {broadcastOpen ? (
          <VenueBroadcastModal agencyId={agencyId} onClose={() => setBroadcastOpen(false)} />
        ) : null}
        {activeIncident ? (
          <IncidentCameraPanel
            agencyId={agencyId}
            incident={activeIncident}
            canDispatch={canSupervisor}
            onClose={() => setActiveIncident(null)}
          />
        ) : null}
      </div>
    </HelpChrome>
  );
}

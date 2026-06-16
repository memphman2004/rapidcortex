/**
 * Rapid Cortex — Campus Safety Dashboard
 *
 * Intentionally distinct from the 911 Dispatcher dashboard:
 *   - No CAD entry, no call transcript, no unit beat table
 *   - Threat level system: SECURE → ELEVATED → HIGH ALERT → LOCKDOWN
 *   - Building grid + campus zone map as the primary spatial model
 *   - Mass notification as a primary action panel
 *   - Responders shown as campus security officers, not "units 101–502"
 *   - Institutional navy/sky-blue palette, not emergency red
 *
 * Route: /app/campus/{role} and /app/campus/{code} (campus vertical only).
 */

"use client";

import { useState, useEffect, type ElementType, type ReactNode } from "react";
import {
  ShieldCheck, AlertTriangle, Building2, Users, Bell,
  MapPin, Camera, Settings, Plus, FileText,
  Activity, Clock, Radio, Siren, AlertCircle, Lock,
} from "lucide-react";
import { ROLE_DISPLAY_LABELS } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserRole } from "rapid-cortex-shared/types";

// ─── Design tokens (campus palette — distinct from 911 RC dark theme) ─────────
const C = {
  bg:           "#07111f",
  bgDeep:       "#04090f",
  surface:      "#0a1929",
  surfaceAlt:   "#0d2035",
  surfaceHover: "#0f2540",
  border:       "#1a2e48",
  borderSoft:   "#0f1e30",

  // Campus blue accent — institutional, not emergency red
  blue:         "#38bdf8",
  blueDim:      "#071828",
  blueMid:      "#0369a1",

  // Status colors
  green:        "#22c55e",
  greenDim:     "#071a10",
  amber:        "#f59e0b",
  amberDim:     "#1a1607",
  orange:       "#f97316",
  orangeDim:    "#1a0e07",
  red:          "#ef4444",
  redDim:       "#1a0707",

  // Purple for notifications
  purple:       "#a78bfa",
  purpleDim:    "#120e1e",

  // Text
  textPrimary:  "#dde6f0",
  textSecondary:"#4d7a9e",
  textMuted:    "#1e3a52",
  silver:       "#7ba8c4",
};

// ─── Threat level configuration ───────────────────────────────────────────────
type ThreatLevel = "secure" | "elevated" | "high" | "lockdown";

const THREAT = {
  secure: {
    label:     "SECURE",
    sublabel:  "All systems nominal · No active alerts",
    color:     C.green,
    dim:       C.greenDim,
    border:    "#16503a",
    icon:      ShieldCheck,
  },
  elevated: {
    label:     "ELEVATED",
    sublabel:  "Heightened awareness · Monitor all zones",
    color:     C.amber,
    dim:       "#2d1f0a",
    border:    "#4a3500",
    icon:      AlertTriangle,
  },
  high: {
    label:     "HIGH ALERT",
    sublabel:  "Immediate response required · All units active",
    color:     C.orange,
    dim:       "#2d1207",
    border:    "#7c2d12",
    icon:      Siren,
  },
  lockdown: {
    label:     "LOCKDOWN",
    sublabel:  "Campus lockdown in effect · Follow protocol",
    color:     C.red,
    dim:       C.redDim,
    border:    "#7f1d1d",
    icon:      Lock,
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Incident {
  id:        string;
  type:      string;
  typeColor: string;
  location:  string;
  building:  string;
  zone:      string;
  ago:       string;
  status:    "DISPATCHED" | "EN ROUTE" | "ON SCENE" | "CLOSED";
  priority:  "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface Responder {
  id:        string;
  initials:  string;
  name:      string;
  zone:      string;
  status:    "AVAILABLE" | "EN ROUTE" | "ON SCENE" | "OFF DUTY";
  role:      string;
}

interface Building {
  id:        string;
  name:      string;
  abbr:      string;
  zone:      string;
  status:    "clear" | "incident" | "monitoring" | "closed";
  occupancy: number | null;
}

interface Zone {
  id:        string;
  name:      string;
  color:     string;
  incidents: number;
  responders:number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_INCIDENTS: Incident[] = [
  {
    id: "INC-0441", type: "MEDICAL", typeColor: C.red,
    location: "Room 204", building: "Reed Hall", zone: "CORE",
    ago: "4m ago", status: "ON SCENE", priority: "HIGH",
  },
  {
    id: "INC-0440", type: "SECURITY", typeColor: C.amber,
    location: "Level 3", building: "North Parking Deck", zone: "NORTH",
    ago: "11m ago", status: "EN ROUTE", priority: "MEDIUM",
  },
  {
    id: "INC-0438", type: "FACILITIES", typeColor: C.blue,
    location: "Stairwell B", building: "Science Library", zone: "EAST",
    ago: "34m ago", status: "DISPATCHED", priority: "LOW",
  },
];

const MOCK_RESPONDERS: Responder[] = [
  { id: "r1", initials: "MJ", name: "M. Jackson",  zone: "CORE",  status: "ON SCENE",  role: "Security Officer" },
  { id: "r2", initials: "TW", name: "T. Williams", zone: "NORTH", status: "EN ROUTE",  role: "Patrol Supervisor" },
  { id: "r3", initials: "AL", name: "A. Lee",      zone: "EAST",  status: "AVAILABLE", role: "Security Officer" },
  { id: "r4", initials: "DS", name: "D. Smith",    zone: "WEST",  status: "AVAILABLE", role: "Security Officer" },
  { id: "r5", initials: "KP", name: "K. Patel",    zone: "SOUTH", status: "AVAILABLE", role: "Health Services"  },
  { id: "r6", initials: "RM", name: "R. Martin",   zone: "CORE",  status: "AVAILABLE", role: "Security Officer" },
];

const MOCK_BUILDINGS: Building[] = [
  { id: "b1",  name: "Reed Hall",         abbr: "Reed",    zone: "CORE",  status: "incident",   occupancy: 340 },
  { id: "b2",  name: "North Parking",     abbr: "N.Prk",   zone: "NORTH", status: "incident",   occupancy: null },
  { id: "b3",  name: "Tate Center",       abbr: "Tate",    zone: "CORE",  status: "clear",      occupancy: 210 },
  { id: "b4",  name: "Main Library",      abbr: "Lib",     zone: "CORE",  status: "clear",      occupancy: 480 },
  { id: "b5",  name: "Science Library",   abbr: "SciLib",  zone: "EAST",  status: "monitoring", occupancy: 90  },
  { id: "b6",  name: "MLC",               abbr: "MLC",     zone: "CORE",  status: "clear",      occupancy: 520 },
  { id: "b7",  name: "Stegeman Coliseum", abbr: "Stege",   zone: "WEST",  status: "clear",      occupancy: 0   },
  { id: "b8",  name: "Ramsey Center",     abbr: "Ramsey",  zone: "SOUTH", status: "clear",      occupancy: 150 },
  { id: "b9",  name: "Sanford Stadium",   abbr: "Sanf",    zone: "WEST",  status: "clear",      occupancy: 0   },
  { id: "b10", name: "Memorial Hall",     abbr: "Mem",     zone: "CORE",  status: "clear",      occupancy: 60  },
  { id: "b11", name: "Park Hall",         abbr: "Park",    zone: "CORE",  status: "clear",      occupancy: 125 },
  { id: "b12", name: "Fine Arts",         abbr: "FineArt", zone: "EAST",  status: "clear",      occupancy: 88  },
];

const MOCK_ZONES: Zone[] = [
  { id: "north",    name: "North",        color: C.green,  incidents: 1, responders: 2 },
  { id: "core",     name: "Core",         color: C.amber,  incidents: 1, responders: 4 },
  { id: "east",     name: "East",         color: C.blue,   incidents: 0, responders: 2 },
  { id: "west",     name: "West",         color: C.green,  incidents: 0, responders: 2 },
  { id: "south",    name: "South",        color: C.green,  incidents: 0, responders: 2 },
  { id: "research", name: "Research Pk",  color: C.blue,   incidents: 0, responders: 1 },
];

// ─── Utility ──────────────────────────────────────────────────────────────────
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

const INCIDENT_PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: C.red,
  HIGH:     C.orange,
  MEDIUM:   C.amber,
  LOW:      C.blue,
};

const RESPONDER_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: C.green,
  "EN ROUTE": C.blue,
  "ON SCENE": C.amber,
  "OFF DUTY": C.textMuted,
};

const BUILDING_STATUS: Record<string, { color: string; label: string }> = {
  incident:   { color: C.amber,   label: "Incident" },
  monitoring: { color: C.blue,    label: "Monitoring" },
  clear:      { color: C.green,   label: "Clear" },
  closed:     { color: C.textMuted, label: "Closed" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThreatBanner({ level, onChangeLevel }: {
  level: ThreatLevel;
  onChangeLevel: (l: ThreatLevel) => void;
}) {
  const cfg    = THREAT[level];
  const Icon   = cfg.icon;
  const levels = Object.keys(THREAT) as ThreatLevel[];

  return (
    <div style={{
      background:   cfg.dim,
      border:       `1px solid ${cfg.border}`,
      borderRadius: 8,
      padding:      "10px 14px",
      display:      "flex",
      alignItems:   "center",
      gap:          10,
    }}>
      <Icon size={16} color={cfg.color} />
      <div style={{ flex: 1 }}>
        <span style={{ color: cfg.color, fontWeight: 700, fontSize: 12, letterSpacing: "0.05em" }}>
          THREAT LEVEL: {cfg.label}
        </span>
        <span style={{ color: cfg.color, fontSize: 11, marginLeft: 12, opacity: 0.75 }}>
          {cfg.sublabel}
        </span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {levels.map((l) => (
          <button
            key={l}
            onClick={() => onChangeLevel(l)}
            style={{
              padding:      "3px 9px",
              borderRadius: 4,
              fontSize:     10,
              fontWeight:   700,
              letterSpacing: "0.04em",
              cursor:       "pointer",
              border:       `1px solid ${THREAT[l].border}`,
              background:   l === level ? THREAT[l].dim : "transparent",
              color:        l === level ? THREAT[l].color : C.textMuted,
            }}
          >
            {THREAT[l].label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, dim, subtitle }: {
  icon: ElementType;
  label: string;
  value: string | number;
  color: string;
  dim: string;
  subtitle?: string;
}) {
  return (
    <div style={{
      background: C.surface,
      border:     `1px solid ${C.border}`,
      borderRadius: 8,
      padding:    "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: dim, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ color, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ color: C.silver, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>{label}</div>
      {subtitle && <div style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  const statusColors: Record<string, string> = {
    DISPATCHED: C.blue,
    "EN ROUTE": C.amber,
    "ON SCENE":  C.orange,
    CLOSED:      C.textMuted,
  };
  return (
    <div style={{
      background:   C.surfaceAlt,
      border:       `1px solid ${C.border}`,
      borderRadius: 6,
      padding:      "8px 10px",
      display:      "flex",
      alignItems:   "center",
      gap:          10,
    }}>
      <div style={{
        background:   incident.typeColor + "22",
        border:       `1px solid ${incident.typeColor}44`,
        borderRadius: 4,
        padding:      "2px 6px",
        fontSize:     10,
        fontWeight:   700,
        color:        incident.typeColor,
        letterSpacing: "0.04em",
        flexShrink:   0,
        minWidth:     70,
        textAlign:    "center",
      }}>
        {incident.type}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ color: C.textPrimary, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {incident.building}
        </div>
        <div style={{ color: C.textSecondary, fontSize: 11 }}>{incident.location} · {incident.zone}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span style={{
          background:   statusColors[incident.status] + "22",
          color:        statusColors[incident.status],
          fontSize:     10, fontWeight: 700, padding: "1px 6px",
          borderRadius: 999, letterSpacing: "0.04em",
        }}>
          {incident.status}
        </span>
        <span style={{ color: C.textMuted, fontSize: 10 }}>{incident.ago}</span>
      </div>
    </div>
  );
}

function CampusZoneGrid({ zones }: { zones: Zone[] }) {
  return (
    <div style={{ padding: "12px 14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {zones.map((z) => (
          <div
            key={z.id}
            style={{
              background:   z.incidents > 0 ? C.amberDim : C.surfaceAlt,
              border:       `1px solid ${z.incidents > 0 ? "#4a3500" : C.border}`,
              borderRadius: 6,
              padding:      "8px 10px",
            }}
          >
            <div style={{ color: z.incidents > 0 ? C.amber : C.silver, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
              {z.name.toUpperCase()}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <span style={{ color: z.incidents > 0 ? C.amber : C.textMuted, fontSize: 10 }}>
                {z.incidents} incident{z.incidents !== 1 ? "s" : ""}
              </span>
              <span style={{ color: C.textMuted, fontSize: 10 }}>
                {z.responders} resp.
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponderCard({ responder }: { responder: Responder }) {
  const statusColor = RESPONDER_STATUS_COLOR[responder.status];
  const initials = responder.initials;
  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      gap:          8,
      padding:      "6px 0",
      borderBottom: `1px solid ${C.borderSoft}`,
    }}>
      <div style={{
        width:        30, height: 30, borderRadius: "50%",
        background:   C.surfaceAlt,
        border:       `1px solid ${C.border}`,
        display:      "flex", alignItems: "center", justifyContent: "center",
        fontSize:     11, fontWeight: 700, color: C.blue, flexShrink: 0,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ color: C.textPrimary, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {responder.name}
        </div>
        <div style={{ color: C.textSecondary, fontSize: 10 }}>{responder.zone} · {responder.role}</div>
      </div>
      <span style={{
        background:   statusColor + "22",
        color:        statusColor,
        fontSize:     9, fontWeight: 700,
        padding:      "2px 5px", borderRadius: 999,
        letterSpacing: "0.04em", flexShrink: 0,
      }}>
        {responder.status}
      </span>
    </div>
  );
}

function BuildingStatusGrid({ buildings }: { buildings: Building[] }) {
  return (
    <div style={{
      display:             "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
      gap:                 6,
    }}>
      {buildings.map((b) => {
        const s = BUILDING_STATUS[b.status];
        return (
          <div
            key={b.id}
            style={{
              background:   b.status === "incident" ? C.amberDim : b.status === "monitoring" ? C.blueDim : C.surfaceAlt,
              border:       `1px solid ${b.status === "incident" ? "#4a3500" : b.status === "monitoring" ? "#0c2d4a" : C.border}`,
              borderRadius: 6,
              padding:      "8px 10px",
              cursor:       "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ color: C.textPrimary, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {b.name}
              </span>
            </div>
            <div style={{ color: C.textSecondary, fontSize: 10 }}>
              {b.zone}
              {b.occupancy !== null && ` · ${b.occupancy}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MassNotifyPanel({ threatLevel: _threatLevel }: { threatLevel: ThreatLevel }) {
  const [selected, setSelected] = useState<string | null>(null);
  const audiences = [
    { id: "all_students", label: "All students",    icon: Users,     count: "38,400" },
    { id: "all_staff",    label: "All staff",        icon: Activity,  count: "5,200" },
    { id: "by_building",  label: "By building",      icon: Building2, count: "—" },
    { id: "by_zone",      label: "By zone",          icon: MapPin,    count: "—" },
  ];

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.silver, letterSpacing: "0.05em" }}>MASS NOTIFICATION</span>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
        {audiences.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => setSelected(selected === a.id ? null : a.id)}
              style={{
                display:     "flex",
                alignItems:  "center",
                gap:         8,
                padding:     "7px 10px",
                background:  selected === a.id ? C.blueDim : C.surfaceAlt,
                border:      `1px solid ${selected === a.id ? C.blueMid : C.border}`,
                borderRadius: 6,
                cursor:      "pointer",
                textAlign:   "left",
              }}
            >
              <Icon size={13} color={selected === a.id ? C.blue : C.textSecondary} />
              <span style={{ color: selected === a.id ? C.blue : C.textPrimary, fontSize: 12, fontWeight: 600, flex: 1 }}>{a.label}</span>
              <span style={{ color: C.textMuted, fontSize: 10 }}>{a.count}</span>
            </button>
          );
        })}

        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            disabled={!selected}
            style={{
              padding:     "7px",
              background:  selected ? C.blueMid : C.bgDeep,
              border:      `1px solid ${selected ? C.blue : C.border}`,
              borderRadius: 6,
              color:       selected ? "#fff" : C.textMuted,
              fontSize:    11,
              fontWeight:  700,
              cursor:      selected ? "pointer" : "not-allowed",
              letterSpacing: "0.04em",
            }}
          >
            SEND NOTIFICATION
          </button>
          <button
            style={{
              padding:     "7px",
              background:  "#7f1d1d",
              border:      "1px solid #991b1b",
              borderRadius: 6,
              color:       "#fca5a5",
              fontSize:    11,
              fontWeight:  700,
              cursor:      "pointer",
              letterSpacing: "0.04em",
            }}
          >
            ⚠ EMERGENCY BROADCAST
          </button>
        </div>
      </div>
    </div>
  );
}

function SidePanel({ label, icon: Icon, children }: { label: string; icon: ElementType; children: ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={C.silver} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.silver, letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ padding: "10px 12px" }}>{children}</div>
    </div>
  );
}

// ─── Nav sidebar ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: Activity,   label: "Overview",   active: true  },
  { icon: AlertTriangle, label: "Incidents" },
  { icon: Building2,  label: "Buildings"  },
  { icon: Users,      label: "Responders" },
  { icon: MapPin,     label: "Zones"      },
  { icon: Bell,       label: "Notify"     },
  { icon: Camera,     label: "Cameras"    },
];

function NavItem({ icon: Icon, label, active }: { icon: ElementType; label: string; active?: boolean }) {
  return (
    <div
      title={label}
      style={{
        width:        40,
        height:       40,
        borderRadius: 8,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        cursor:       "pointer",
        background:   active ? C.blueDim : "transparent",
        border:       `1px solid ${active ? C.blueMid : "transparent"}`,
      }}
    >
      <Icon size={17} color={active ? C.blue : C.textMuted} />
    </div>
  );
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
function roleLabel(role: string | undefined): string {
  if (!role?.trim()) return "CAMPUS OPERATOR";
  const key = role.trim().toUpperCase() as UserRole;
  return (ROLE_DISPLAY_LABELS[key] ?? role.replace(/_/g, " ")).toUpperCase();
}

export function CampusSafetyDashboard({
  agencyName = "Campus",
  agencySlug = "campus",
  userEmail = "",
  userRole,
}: {
  agencyName?: string;
  agencySlug?: string;
  userEmail?: string;
  userRole?: string;
}) {
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>("secure");
  const [incidents]  = useState<Incident[]>(MOCK_INCIDENTS);
  const [responders] = useState<Responder[]>(MOCK_RESPONDERS);
  const [buildings]  = useState<Building[]>(MOCK_BUILDINGS);
  const [zones]      = useState<Zone[]>(MOCK_ZONES);

  const activeIncidents  = incidents.filter((i) => i.status !== "CLOSED");
  const availableRes     = responders.filter((r) => r.status === "AVAILABLE").length;

  return (
    <div style={{
      background: C.bg,
      minHeight:  "100vh",
      display:    "flex",
      flexDirection: "column",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      color:      C.textPrimary,
    }}>

      {/* ── Header ── */}
      <header style={{
        background:    C.surface,
        borderBottom:  `1px solid ${C.border}`,
        padding:       "0 16px",
        height:        52,
        display:       "flex",
        alignItems:    "center",
        gap:           12,
        flexShrink:    0,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: C.surfaceAlt, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck size={16} color={C.blue} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, letterSpacing: "0.01em" }}>
              Campus Safety
            </div>
            <div style={{ fontSize: 10, color: C.textSecondary, letterSpacing: "0.05em" }}>
              {agencyName.toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: C.border, margin: "0 4px" }} />

        {/* Agency context */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            background: C.surfaceAlt, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "3px 10px",
            fontSize: 11, color: C.silver, fontWeight: 600,
          }}>
            {agencySlug.toUpperCase()}
          </span>
          <span style={{
            background: "#142b1a", border: "1px solid #1e5c2a",
            borderRadius: 6, padding: "3px 10px",
            fontSize: 11, color: C.green, fontWeight: 600, letterSpacing: "0.04em",
          }}>
            PROD
          </span>
        </div>

        {/* Threat indicator */}
        <div style={{
          display:      "flex",
          alignItems:   "center",
          gap:          6,
          padding:      "4px 12px",
          borderRadius: 999,
          background:   THREAT[threatLevel].dim,
          border:       `1px solid ${THREAT[threatLevel].border}`,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: THREAT[threatLevel].color,
          }} />
          <span style={{
            fontSize:      11,
            fontWeight:    700,
            color:         THREAT[threatLevel].color,
            letterSpacing: "0.05em",
          }}>
            {THREAT[threatLevel].label}
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Clock */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.textSecondary, fontSize: 12 }}>
          <Clock size={13} />
          <LiveClock />
        </div>

        {/* Shift */}
        <div style={{ color: C.textMuted, fontSize: 11 }}>
          Shift <span style={{ color: C.textSecondary }}>00:42:17</span>
        </div>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: C.blueDim, border: `1px solid ${C.blueMid}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: C.blue,
          }}>
            {(userEmail || agencySlug).slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: 11 }}>
            <div style={{ color: C.textPrimary, fontWeight: 600 }}>
              {userEmail
                ? userEmail.split("@")[0]!.replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : agencySlug}
            </div>
            <div style={{ color: C.textMuted, fontSize: 10, letterSpacing: "0.04em" }}>{roleLabel(userRole)}</div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left nav */}
        <nav style={{
          width:         52,
          background:    C.bgDeep,
          borderRight:   `1px solid ${C.borderSoft}`,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          padding:       "12px 0",
          gap:           4,
          flexShrink:    0,
        }}>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
          <div style={{ flex: 1 }} />
          <NavItem icon={Settings} label="Settings" />
        </nav>

        {/* Main content */}
        <main style={{
          flex:     1,
          overflow: "auto",
          padding:  14,
          display:  "flex",
          flexDirection: "column",
          gap:      12,
          minWidth: 0,
        }}>
          {/* Threat level banner */}
          <ThreatBanner level={threatLevel} onChangeLevel={setThreatLevel} />

          {/* Metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <MetricCard icon={AlertCircle}  label="Active incidents"    value={activeIncidents.length} color={C.amber}  dim={C.amberDim}  subtitle="2 require response" />
            <MetricCard icon={Users}        label="Responders on duty"  value={responders.length}      color={C.blue}   dim={C.blueDim}   subtitle={`${availableRes} available`} />
            <MetricCard icon={Building2}    label="Buildings monitored" value={buildings.length}        color={C.green}  dim={C.greenDim}  subtitle="All sensors active" />
            <MetricCard icon={Bell}         label="Alerts sent today"   value={3}                       color={C.purple} dim={C.purpleDim} subtitle="Last: 08:12 AM" />
          </div>

          {/* Incidents + Zones */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Active incidents */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} color={C.silver} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.silver, letterSpacing: "0.05em" }}>ACTIVE INCIDENTS</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ background: C.amberDim, color: C.amber, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, letterSpacing: "0.04em" }}>
                    {activeIncidents.length} OPEN
                  </span>
                  <button style={{ display: "flex", alignItems: "center", gap: 4, background: C.blueDim, border: `1px solid ${C.blueMid}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: C.blue, fontSize: 10, fontWeight: 600 }}>
                    <Plus size={11} /> New
                  </button>
                </div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {incidents.map((inc) => (
                  <IncidentRow key={inc.id} incident={inc} />
                ))}
                <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 11, textAlign: "center", padding: "4px 0" }}>
                  View all incidents →
                </button>
              </div>
            </div>

            {/* Zone status */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={13} color={C.silver} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.silver, letterSpacing: "0.05em" }}>CAMPUS ZONES</span>
                </div>
                <span style={{ fontSize: 10, color: C.textMuted }}>6 zones active</span>
              </div>
              <CampusZoneGrid zones={zones} />
            </div>
          </div>

          {/* Building status grid */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={13} color={C.silver} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.silver, letterSpacing: "0.05em" }}>BUILDING STATUS</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {Object.entries(BUILDING_STATUS).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.color }} />
                    <span style={{ color: C.textMuted, fontSize: 10 }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "10px 14px" }}>
              <BuildingStatusGrid buildings={buildings} />
            </div>
          </div>
        </main>

        {/* Right panel */}
        <aside style={{
          width:        220,
          background:   C.bgDeep,
          borderLeft:   `1px solid ${C.borderSoft}`,
          padding:      12,
          display:      "flex",
          flexDirection: "column",
          gap:          10,
          overflowY:    "auto",
          flexShrink:   0,
        }}>
          {/* Mass notification */}
          <MassNotifyPanel threatLevel={threatLevel} />

          {/* Responders */}
          <SidePanel label="ON DUTY" icon={Users}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {responders.slice(0, 5).map((r) => (
                <ResponderCard key={r.id} responder={r} />
              ))}
              <div style={{ paddingTop: 8, textAlign: "center" }}>
                <span style={{ color: C.textMuted, fontSize: 10 }}>+{responders.length - 5} more on duty</span>
              </div>
            </div>
          </SidePanel>

          {/* Quick actions */}
          <SidePanel label="QUICK ACTIONS" icon={Activity}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { icon: Plus,       label: "New incident" },
                { icon: Camera,     label: "View cameras" },
                { icon: MapPin,     label: "AED locator" },
                { icon: Radio,      label: "All-call radio" },
                { icon: FileText,   label: "Shift report" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  style={{
                    display:     "flex",
                    alignItems:  "center",
                    gap:         8,
                    padding:     "7px 10px",
                    background:  C.surfaceAlt,
                    border:      `1px solid ${C.border}`,
                    borderRadius: 6,
                    cursor:      "pointer",
                    color:       C.textPrimary,
                    fontSize:    12,
                    fontWeight:  500,
                    textAlign:   "left",
                  }}
                >
                  <Icon size={13} color={C.textSecondary} />
                  {label}
                </button>
              ))}
            </div>
          </SidePanel>
        </aside>
      </div>
    </div>
  );
}

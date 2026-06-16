/**
 * Rapid Cortex — Venue Operations Dashboard
 *
 * Built for: stadiums, arenas, concert venues, convention centers.
 *
 * Distinct from 911 Dispatcher:
 *   No CAD entry, no telephony, no transcript, no AI suggested panel
 *
 * Distinct from Campus Safety:
 *   No buildings grid, no threat levels, no mass student notification
 *
 * Venue-specific model:
 *   - Event phase timeline: PRE-EVENT → GATES OPEN → IN-EVENT → HALFTIME → IN-EVENT → FINAL → POST-EVENT → DARK
 *   - Spatial model: sections (100s/200s/300s), concourses, gates — not buildings or beats
 *   - Ejection log as a primary operational record
 *   - Gate flow and crowd density monitoring
 *   - Staff deployment by zone
 *   - Incident types: Medical, Ejection, Altercation, Lost Child, Suspicious Item, Fire, Crowd Surge
 *
 * Palette: deep charcoal + violet — distinct from 911 red and campus navy/sky-blue
 *
 * Route: /app/venue/{role} (venue vertical only).
 */

"use client";

import { useState, useEffect, type ElementType, type ReactNode } from "react";
import {
  Ticket, AlertTriangle, DoorOpen, Users, Camera,
  FileText, Settings, Plus, Radio, UserX, Activity,
  ChevronRight, Clock, Heart, Shield, MapPin,
  AlertCircle, Ban, Volume2, BarChart3,
} from "lucide-react";
import { ROLE_DISPLAY_LABELS } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserRole } from "rapid-cortex-shared/types";
import {
  SectionBowlMap,
  useSections,
  type SectionLevel,
} from "./venue-section-config";

export type EventPhase =
  | "pre_event"
  | "gates_open"
  | "in_event_1"
  | "halftime"
  | "in_event_2"
  | "final_whistle"
  | "post_event"
  | "dark";

// ─── Design tokens — venue palette ───────────────────────────────────────────
const V = {
  bg:           "#0c0b14",
  bgDeep:       "#080710",
  surface:      "#100e1a",
  surfaceAlt:   "#141220",
  surfaceHover: "#1a1528",
  border:       "#1e1a30",
  borderSoft:   "#150f24",

  // Violet — event/entertainment energy, not emergency red or institutional blue
  violet:       "#8b5cf6",
  violetDim:    "#130e1e",
  violetMid:    "#4c1d95",

  // Status colors
  green:        "#10b981",
  greenDim:     "#0a1810",
  amber:        "#f59e0b",
  amberDim:     "#1a1206",
  red:          "#ef4444",
  redDim:       "#1a0808",
  blue:         "#38bdf8",
  blueDim:      "#071828",

  // Text
  textPrimary:  "#e4dff5",
  textSecondary:"#5a4d7a",
  textMuted:    "#2d2445",
  silver:       "#7c6fa0",
};

// ─── Event phase model ────────────────────────────────────────────────────────
interface PhaseConfig {
  label:    string;
  short:    string;
  color:    string;
  dim:      string;
  border:   string;
  isActive: boolean;
}

const PHASE_CONFIG: Record<EventPhase, PhaseConfig> = {
  pre_event:     { label: "Pre-Event",      short: "PRE",      color: V.silver,  dim: V.surfaceAlt, border: V.border,     isActive: false },
  gates_open:    { label: "Gates Open",     short: "GATES",    color: V.blue,    dim: V.blueDim,    border: "#0c3d5c",    isActive: true  },
  in_event_1:    { label: "In Event",       short: "LIVE",     color: V.green,   dim: V.greenDim,   border: "#1a4d35",    isActive: true  },
  halftime:      { label: "Halftime",       short: "HT",       color: V.amber,   dim: V.amberDim,   border: "#4a3500",    isActive: true  },
  in_event_2:    { label: "In Event",       short: "LIVE",     color: V.green,   dim: V.greenDim,   border: "#1a4d35",    isActive: true  },
  final_whistle: { label: "Final Whistle",  short: "FINAL",    color: V.violet,  dim: V.violetDim,  border: "#3b1e6e",    isActive: true  },
  post_event:    { label: "Post-Event",     short: "POST",     color: V.amber,   dim: V.amberDim,   border: "#4a3500",    isActive: false },
  dark:          { label: "Dark",           short: "DARK",     color: V.textSecondary, dim: V.bgDeep, border: V.borderSoft, isActive: false },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type IncidentType  = "MEDICAL" | "EJECTION" | "ALTERCATION" | "LOST CHILD" | "SUSPICIOUS" | "FIRE" | "CROWD SURGE" | "INTOXICATION";
type IncidentStatus = "DISPATCHED" | "EN ROUTE" | "ON SCENE" | "RESOLVED" | "PROCESSING";
type GateStatus    = "open" | "overflow" | "closed" | "exit_only";

interface VenueIncident {
  id:       string;
  type:     IncidentType;
  section:  string;
  location: string;
  ago:      string;
  status:   IncidentStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  officer:  string;
}

interface Gate {
  id:        string;
  label:     string;
  status:    GateStatus;
  entrances: number;
  flowRate:  number; // per minute
}

interface Ejection {
  id:      string;
  section: string;
  reason:  string;
  time:    string;
  status:  "PROCESSING" | "BANNED" | "RELEASED";
}

interface StaffZone {
  zone:    string;
  count:   number;
  color:   string;
  needed:  number;
}

// ─── Event timeline steps ─────────────────────────────────────────────────────
interface TimelineStep {
  phase:     EventPhase;
  label:     string;
  time:      string;
  completed: boolean;
  current:   boolean;
}

const EVENT_TIMELINE: TimelineStep[] = [
  { phase: "gates_open",    label: "Gates Open",    time: "5:00 PM",  completed: true,  current: false },
  { phase: "in_event_1",   label: "Kickoff",        time: "7:00 PM",  completed: true,  current: false },
  { phase: "halftime",      label: "Halftime",       time: "8:45 PM",  completed: true,  current: false },
  { phase: "in_event_2",   label: "Q3 · Now",       time: "9:32 PM",  completed: false, current: true  },
  { phase: "final_whistle", label: "Final Whistle",  time: "~10:15 PM",completed: false, current: false },
  { phase: "post_event",    label: "Post-Event",     time: "~10:45 PM",completed: false, current: false },
];

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_INCIDENTS: VenueIncident[] = [
  {
    id: "V-0344", type: "MEDICAL",     section: "124",  location: "Row J · Seat 14",
    ago: "2m",  status: "ON SCENE",   priority: "HIGH",   officer: "R. Torres",
  },
  {
    id: "V-0343", type: "EJECTION",    section: "120",  location: "Gate C2 entry",
    ago: "8m",  status: "PROCESSING", priority: "MEDIUM", officer: "K. Davis",
  },
  {
    id: "V-0341", type: "ALTERCATION", section: "Club", location: "West concourse bar",
    ago: "15m", status: "RESOLVED",   priority: "MEDIUM", officer: "M. Wilson",
  },
  {
    id: "V-0339", type: "LOST CHILD",  section: "132",  location: "Near section entry",
    ago: "22m", status: "RESOLVED",   priority: "HIGH",   officer: "S. Chen",
  },
];

const MOCK_GATES: Gate[] = [
  { id: "A", label: "Gate A",  status: "open",      entrances: 4210, flowRate: 0   },
  { id: "B", label: "Gate B",  status: "open",      entrances: 3890, flowRate: 0   },
  { id: "C", label: "Gate C",  status: "overflow",  entrances: 6100, flowRate: 12  },
  { id: "D", label: "Gate D",  status: "open",      entrances: 3440, flowRate: 0   },
  { id: "E", label: "Gate E",  status: "open",      entrances: 2980, flowRate: 0   },
  { id: "F", label: "Gate F",  status: "open",      entrances: 3670, flowRate: 0   },
  { id: "G", label: "Gate G",  status: "closed",    entrances: 0,    flowRate: 0   },
  { id: "H", label: "Gate H",  status: "exit_only", entrances: 4050, flowRate: 48  },
];

const MOCK_EJECTIONS: Ejection[] = [
  { id: "e7", section: "120", reason: "Intoxication",  time: "9:14 PM", status: "PROCESSING" },
  { id: "e6", section: "118", reason: "Fighting",      time: "8:52 PM", status: "BANNED"     },
  { id: "e5", section: "125", reason: "Field attempt", time: "8:41 PM", status: "RELEASED"   },
  { id: "e4", section: "122", reason: "Harassment",    time: "7:58 PM", status: "BANNED"     },
  { id: "e3", section: "131", reason: "Intoxication",  time: "7:32 PM", status: "RELEASED"   },
];

const MOCK_STAFF: StaffZone[] = [
  { zone: "Lower Bowl",  count: 148, needed: 140, color: V.green  },
  { zone: "Club Level",  count: 52,  needed: 55,  color: V.violet },
  { zone: "Upper Deck",  count: 64,  needed: 70,  color: V.blue   },
  { zone: "Concourse",   count: 28,  needed: 30,  color: V.amber  },
  { zone: "Exterior",    count: 20,  needed: 20,  color: V.silver },
];

// ─── Utility ──────────────────────────────────────────────────────────────────
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

const INCIDENT_COLORS: Record<IncidentType, string> = {
  MEDICAL:      "#8b5cf6",
  EJECTION:     V.red,
  ALTERCATION:  V.amber,
  "LOST CHILD": V.blue,
  SUSPICIOUS:   V.amber,
  FIRE:         V.red,
  "CROWD SURGE":V.red,
  INTOXICATION: V.amber,
};

const INCIDENT_STATUS_COLORS: Record<IncidentStatus, string> = {
  DISPATCHED: V.blue,
  "EN ROUTE": V.blue,
  "ON SCENE":  V.amber,
  RESOLVED:   V.green,
  PROCESSING: "#8b5cf6",
};

const GATE_STATUS_LABEL: Record<GateStatus, { label: string; color: string; dim: string; border: string }> = {
  open:      { label: "OPEN",      color: V.green,  dim: V.greenDim,  border: "#1a4d35" },
  overflow:  { label: "OVERFLOW",  color: V.amber,  dim: V.amberDim,  border: "#4a3500" },
  closed:    { label: "CLOSED",    color: V.textSecondary, dim: V.bgDeep, border: V.borderSoft },
  exit_only: { label: "EXIT ONLY", color: V.blue,   dim: V.blueDim,   border: "#0c3d5c" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => { const d = new Date(); setT(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return <span>{t}</span>;
}

function EventPhaseBanner({
  phase,
  attendance,
  capacityPct,
  venueCapacity,
}: {
  phase: EventPhase;
  attendance: number;
  capacityPct: number | null;
  venueCapacity: number;
}) {
  const cfg = PHASE_CONFIG[phase];
  return (
    <div style={{
      background: cfg.dim, border: `1px solid ${cfg.border}`,
      borderRadius: 8, padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color,
        animation: cfg.isActive ? "vpulse 1.5s ease-in-out infinite" : "none" }} />
      <span style={{ color: cfg.color, fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>
        {cfg.label.toUpperCase()}
      </span>
      <span style={{ color: cfg.color, fontSize: 11, opacity: 0.7 }}>
        ATL vs NYG · NFL · Q3 · 8:42 remaining
      </span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ background: V.surfaceAlt, borderRadius: 6, padding: "2px 10px", border: `1px solid ${V.border}` }}>
          <span style={{ color: V.textPrimary, fontWeight: 700, fontSize: 14 }}>{attendance.toLocaleString()}</span>
          <span style={{ color: V.textSecondary, fontSize: 10, marginLeft: 6 }}>gate count</span>
        </div>
        <div style={{ background: V.surfaceAlt, borderRadius: 6, padding: "2px 10px", border: `1px solid ${V.border}` }}>
          <span style={{ color: V.textPrimary, fontWeight: 700, fontSize: 14 }}>
            {capacityPct !== null ? `${capacityPct}%` : "—"}
          </span>
          <span style={{ color: V.textSecondary, fontSize: 10, marginLeft: 6 }}>
            {venueCapacity > 0 ? `of ${venueCapacity.toLocaleString()}` : "capacity"}
          </span>
        </div>
      </div>
    </div>
  );
}

function EventTimeline({ steps, onSelectPhase }: { steps: TimelineStep[]; onSelectPhase?: (phase: EventPhase) => void }) {
  return (
    <div style={{
      background: V.bgDeep, borderBottom: `1px solid ${V.borderSoft}`,
      padding: "0 14px", height: 40,
      display: "flex", alignItems: "center", gap: 0, overflowX: "auto",
    }}>
      {steps.map((step, i) => (
        <div key={step.phase} style={{ display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => onSelectPhase?.(step.phase)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "0 8px", cursor: onSelectPhase ? "pointer" : "default",
              background: "none", border: "none",
            }}
          >
            <span style={{
              fontSize: 11, fontWeight: step.current ? 700 : 500,
              color: step.current ? PHASE_CONFIG[step.phase].color : step.completed ? V.silver : V.textSecondary,
              letterSpacing: "0.02em",
            }}>
              {step.label}
            </span>
            <span style={{ fontSize: 9, color: step.current ? PHASE_CONFIG[step.phase].color : V.textMuted }}>
              {step.time}
            </span>
          </button>
          {i < steps.length - 1 && (
            <ChevronRight size={12} color={V.textMuted} style={{ flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, dim, subtitle }: {
  icon: ElementType; label: string; value: string | number;
  color: string; dim: string; subtitle?: string;
}) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: dim, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ color, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ color: V.silver, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>{label}</div>
      {subtitle && <div style={{ color: V.textSecondary, fontSize: 10, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function levelSummaryLabel(levels: SectionLevel[]): string {
  const labels: Record<SectionLevel, string> = {
    lower: "Lower",
    club: "Club",
    upper: "Upper",
    suite: "Suites",
  };
  if (levels.length === 0) return "No sections";
  if (levels.length === 4) return "All levels";
  return levels.map((l) => labels[l]).join(" · ");
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

function IncidentRow({ incident }: { incident: VenueIncident }) {
  const typeColor   = INCIDENT_COLORS[incident.type];
  const statusColor = INCIDENT_STATUS_COLORS[incident.status];
  return (
    <div style={{
      background: V.surfaceAlt, border: `1px solid ${V.border}`,
      borderRadius: 6, padding: "8px 10px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        background: typeColor + "22", border: `1px solid ${typeColor}44`,
        borderRadius: 4, padding: "2px 6px",
        fontSize: 9, fontWeight: 700, color: typeColor, letterSpacing: "0.04em",
        flexShrink: 0, minWidth: 78, textAlign: "center",
      }}>
        {incident.type}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ color: V.textPrimary, fontSize: 12, fontWeight: 600 }}>
          Sec {incident.section}
        </div>
        <div style={{ color: V.textSecondary, fontSize: 11 }}>{incident.location} · {incident.officer}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span style={{ background: statusColor + "22", color: statusColor, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999 }}>
          {incident.status}
        </span>
        <span style={{ color: V.textMuted, fontSize: 10 }}>{incident.ago} ago</span>
      </div>
    </div>
  );
}

function GateGrid({ gates }: { gates: Gate[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
      {gates.map((gate) => {
        const s = GATE_STATUS_LABEL[gate.status];
        return (
          <div key={gate.id} style={{
            background: s.dim, border: `1px solid ${s.border}`,
            borderRadius: 6, padding: "8px 10px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: V.textPrimary, fontSize: 14, fontWeight: 800 }}>Gate {gate.label}</span>
              <span style={{ background: s.dim, color: s.color, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, border: `1px solid ${s.border}` }}>
                {s.label}
              </span>
            </div>
            <div style={{ color: V.textSecondary, fontSize: 11 }}>
              {gate.status !== "closed" ? gate.entrances.toLocaleString() : "—"}
              {gate.status !== "closed" && <span style={{ color: V.textMuted }}> entries</span>}
            </div>
            {gate.flowRate > 0 && (
              <div style={{ color: gate.status === "overflow" ? V.amber : V.blue, fontSize: 10, marginTop: 2 }}>
                {gate.flowRate}/min flow
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EjectionLog({ ejections }: { ejections: Ejection[] }) {
  const statusColors = { PROCESSING: V.violet, BANNED: V.red, RELEASED: V.silver };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {ejections.slice(0, 5).map((e) => (
        <div key={e.id} style={{
          display: "flex", alignItems: "center", gap: 8,
          paddingBottom: 5, borderBottom: `1px solid ${V.borderSoft}`,
        }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: V.redDim, border: `1px solid #3d1010`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <UserX size={12} color={V.red} />
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ color: V.textPrimary, fontSize: 11, fontWeight: 600 }}>Sec {e.section} · {e.reason}</div>
            <div style={{ color: V.textSecondary, fontSize: 10 }}>{e.time}</div>
          </div>
          <span style={{
            color: statusColors[e.status], fontSize: 9, fontWeight: 700,
            padding: "1px 5px", borderRadius: 999,
            background: statusColors[e.status] + "22",
          }}>
            {e.status}
          </span>
        </div>
      ))}
      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <span style={{ color: V.textMuted, fontSize: 10, cursor: "pointer" }}>View all 7 ejections →</span>
      </div>
    </div>
  );
}

function StaffPanel({ zones }: { zones: StaffZone[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {zones.map((z) => {
        const pct = Math.round((z.count / z.needed) * 100);
        const atCapacity = pct >= 100;
        return (
          <div key={z.zone}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: V.textPrimary, fontSize: 11, fontWeight: 600 }}>{z.zone}</span>
              <span style={{ color: atCapacity ? V.green : V.amber, fontSize: 11, fontWeight: 700 }}>
                {z.count}<span style={{ color: V.textMuted, fontWeight: 400 }}>/{z.needed}</span>
              </span>
            </div>
            <div style={{ height: 4, background: V.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: atCapacity ? V.green : V.amber, borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          </div>
        );
      })}
      <div style={{ borderTop: `1px solid ${V.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: V.textSecondary, fontSize: 11 }}>Total on duty</span>
        <span style={{ color: V.textPrimary, fontWeight: 700, fontSize: 11 }}>
          {zones.reduce((s, z) => s + z.count, 0)}
        </span>
      </div>
    </div>
  );
}

function SidePanelShell({ label, icon: Icon, children }: { label: string; icon: ElementType; children: ReactNode }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "9px 12px", borderBottom: `1px solid ${V.border}`, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={12} color={V.silver} />
        <span style={{ fontSize: 11, fontWeight: 700, color: V.silver, letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ padding: "10px 12px" }}>{children}</div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: Activity,  label: "Overview",  active: true  },
  { icon: AlertTriangle, label: "Incidents" },
  { icon: DoorOpen,  label: "Gates"      },
  { icon: Users,     label: "Staff"      },
  { icon: Camera,    label: "Cameras"    },
  { icon: FileText,  label: "Reports"    },
];

function NavItem({ icon: Icon, label, active }: { icon: ElementType; label: string; active?: boolean }) {
  return (
    <div title={label} style={{
      width: 40, height: 40, borderRadius: 8,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer",
      background: active ? V.violetDim : "transparent",
      border: `1px solid ${active ? "#3b1e6e" : "transparent"}`,
    }}>
      <Icon size={17} color={active ? V.violet : V.textSecondary} />
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
function roleLabel(role: string | undefined): string {
  if (!role?.trim()) return "VENUE OPERATIONS";
  const key = role.trim().toUpperCase() as UserRole;
  return (ROLE_DISPLAY_LABELS[key] ?? role.replace(/_/g, " ")).toUpperCase();
}

export function VenueOperationsDashboard({
  venueName = "Venue",
  venueCapacity = 71_000,
  agencySlug = "venue",
  userEmail = "",
  userRole,
  currentPhase = "in_event_2",
}: {
  venueName?: string;
  venueCapacity?: number;
  agencySlug?: string;
  userEmail?: string;
  userRole?: string;
  currentPhase?: EventPhase;
}) {
  const [phase, setPhase] = useState<EventPhase>(currentPhase);
  const [incidents]             = useState<VenueIncident[]>(MOCK_INCIDENTS);
  const [gates]                 = useState<Gate[]>(MOCK_GATES);
  const [ejections]             = useState<Ejection[]>(MOCK_EJECTIONS);
  const [staff]                 = useState<StaffZone[]>(MOCK_STAFF);
  const [resolvedCapacity, setResolvedCapacity] = useState(venueCapacity);
  const [_newIncidentOpen, setNewIncidentOpen] = useState(false);
  const { sections, updateStatus } = useSections(agencySlug);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/venue/${agencySlug}/profile`);
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: { capacity?: number } };
        if (!cancelled && typeof data.profile?.capacity === "number" && data.profile.capacity > 0) {
          setResolvedCapacity(data.profile.capacity);
        }
      } catch {
        // Keep prop/default capacity when profile API is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencySlug]);

  const attendance = gates.reduce((sum, gate) => sum + gate.entrances, 0);
  const capacityPct =
    resolvedCapacity > 0 ? Math.round((attendance / resolvedCapacity) * 100) : null;
  const sectionLevels = Array.from(new Set(sections.map((s) => s.level))) as SectionLevel[];

  const activeIncidents = incidents.filter((i) => i.status !== "RESOLVED");
  const phaseCfg        = PHASE_CONFIG[phase];

  return (
    <div style={{
      background:   V.bg,
      minHeight:    "100vh",
      display:      "flex",
      flexDirection: "column",
      fontFamily:   "'Inter', 'Segoe UI', system-ui, sans-serif",
      color:        V.textPrimary,
    }}>
      <style>{`@keyframes vpulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      {/* ── Header ── */}
      <header style={{
        background:   V.surface,
        borderBottom: `1px solid ${V.border}`,
        padding:      "0 16px",
        height:       52,
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        flexShrink:   0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: V.surfaceAlt, border: `1px solid ${V.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ticket size={16} color={V.violet} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary }}>Venue Operations</div>
            <div style={{ fontSize: 10, color: V.textSecondary, letterSpacing: "0.05em" }}>{venueName.toUpperCase()}</div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: V.border, margin: "0 4px" }} />

        {/* Event info */}
        <div style={{ background: V.surfaceAlt, border: `1px solid ${V.border}`, borderRadius: 6, padding: "4px 12px" }}>
          <span style={{ color: V.silver, fontSize: 11 }}>ATL vs NYG</span>
          <span style={{ color: V.textMuted, fontSize: 11, margin: "0 6px" }}>·</span>
          <span style={{ color: V.textPrimary, fontSize: 11, fontWeight: 600 }}>NFL · Sun 6/15 · 7:00 PM</span>
        </div>

        {/* Phase indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 999,
          background: phaseCfg.dim, border: `1px solid ${phaseCfg.border}`,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: phaseCfg.color, animation: phaseCfg.isActive ? "vpulse 1.5s ease-in-out infinite" : "none" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: phaseCfg.color, letterSpacing: "0.05em" }}>
            {phaseCfg.label.toUpperCase()}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Attendance */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: V.textPrimary, lineHeight: 1 }}>
            {attendance.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: V.textSecondary }}>
            {capacityPct !== null
              ? `${capacityPct}% of ${resolvedCapacity.toLocaleString()}`
              : "gate count"}
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: V.border }} />

        <div style={{ display: "flex", alignItems: "center", gap: 5, color: V.textSecondary, fontSize: 12 }}>
          <Clock size={12} /><LiveClock />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: V.violetDim, border: `1px solid #3b1e6e`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: V.violet }}>
            {(userEmail || agencySlug).slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: 11 }}>
            <div style={{ color: V.textPrimary, fontWeight: 600 }}>
              {userEmail
                ? userEmail.split("@")[0]!.replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : agencySlug}
            </div>
            <div style={{ color: V.textMuted, fontSize: 10, letterSpacing: "0.04em" }}>{roleLabel(userRole)}</div>
          </div>
        </div>
      </header>

      {/* Event timeline strip */}
      <EventTimeline steps={EVENT_TIMELINE} onSelectPhase={setPhase} />

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left nav */}
        <nav style={{ width: 52, background: V.bgDeep, borderRight: `1px solid ${V.borderSoft}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 4, flexShrink: 0 }}>
          {NAV_ITEMS.map((item) => <NavItem key={item.label} {...item} />)}
          <div style={{ flex: 1 }} />
          <NavItem icon={Settings} label="Settings" />
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* Phase banner */}
          <EventPhaseBanner
            phase={phase}
            attendance={attendance}
            capacityPct={capacityPct}
            venueCapacity={resolvedCapacity}
          />

          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <MetricCard icon={AlertCircle} label="Active incidents"  value={activeIncidents.length} color={V.amber}  dim={V.amberDim}  subtitle="2 require response" />
            <MetricCard icon={UserX}       label="Ejections today"   value={ejections.length}       color={V.red}    dim={V.redDim}    subtitle="7 total this event" />
            <MetricCard icon={Heart}       label="Medical responses" value={2}                       color={V.violet} dim={V.violetDim} subtitle="1 currently active" />
            <MetricCard icon={Shield}      label="Staff deployed"    value={312}                     color={V.green}  dim={V.greenDim}  subtitle="5 zones covered" />
          </div>

          {/* Section map + incidents */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${V.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={13} color={V.silver} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: V.silver, letterSpacing: "0.05em" }}>SECTION STATUS</span>
                </div>
                <span style={{ fontSize: 10, color: V.textSecondary }}>
                  {levelSummaryLabel(sectionLevels)} · {sections.length} sections
                </span>
              </div>
              <SectionBowlMap sections={sections} onUpdateStatus={updateStatus} />
            </div>

            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${V.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} color={V.silver} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: V.silver, letterSpacing: "0.05em" }}>ACTIVE INCIDENTS</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ background: V.amberDim, color: V.amber, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                    {activeIncidents.length} OPEN
                  </span>
                  <button
                    onClick={() => setNewIncidentOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: V.violetDim, border: `1px solid #3b1e6e`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: V.violet, fontSize: 10, fontWeight: 600 }}
                  >
                    <Plus size={11} /> New
                  </button>
                </div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {incidents.map((inc) => <IncidentRow key={inc.id} incident={inc} />)}
              </div>
            </div>
          </div>

          {/* Gate status */}
          <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${V.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <DoorOpen size={13} color={V.silver} />
                <span style={{ fontSize: 12, fontWeight: 700, color: V.silver, letterSpacing: "0.05em" }}>GATE STATUS</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {Object.entries(GATE_STATUS_LABEL).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.color }} />
                    <span style={{ color: V.textMuted, fontSize: 10 }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "10px 14px" }}>
              <GateGrid gates={gates} />
            </div>
          </div>
        </main>

        {/* Right panel */}
        <aside style={{ width: 220, background: V.bgDeep, borderLeft: `1px solid ${V.borderSoft}`, padding: 12, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0 }}>

          <SidePanelShell label="EJECTION LOG" icon={UserX}>
            <EjectionLog ejections={ejections} />
          </SidePanelShell>

          <SidePanelShell label="STAFF BY ZONE" icon={Users}>
            <StaffPanel zones={staff} />
          </SidePanelShell>

          <SidePanelShell label="QUICK ACTIONS" icon={Activity}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { icon: UserX,    label: "Log ejection"  },
                { icon: DoorOpen, label: "Close gate"    },
                { icon: Volume2,  label: "PA broadcast"  },
                { icon: Camera,   label: "Camera feeds"  },
                { icon: BarChart3,label: "Crowd density" },
                { icon: FileText, label: "Event report"  },
              ].map(({ icon: Icon, label }) => (
                <button key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: V.surfaceAlt, border: `1px solid ${V.border}`, borderRadius: 6, cursor: "pointer", color: V.textPrimary, fontSize: 12, fontWeight: 500, textAlign: "left" }}>
                  <Icon size={13} color={V.textSecondary} />
                  {label}
                </button>
              ))}
            </div>
          </SidePanelShell>

        </aside>
      </div>
    </div>
  );
}

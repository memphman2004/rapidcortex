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

import Link from "next/link";
import { useState, useEffect, type ElementType, type ReactNode } from "react";
import {
  ShieldCheck, AlertTriangle, Building2, Users, Bell,
  MapPin, Camera, Settings, Plus, FileText,
  Activity, Clock, Radio, Siren, AlertCircle, Lock,
} from "lucide-react";
import type { CampusNotificationBody } from "rapid-cortex-shared";
import {
  postCampusBroadcast,
  postCampusNotification,
} from "@/lib/campus/campus-dashboard-api";
import { canCampusSupervisorOps } from "@/lib/vertical/supervisor-access";
import {
  formatTimeAgo,
  mapIncidentStatus,
  mapIncidentType,
  useCampusDashboard,
  type UiThreatLevel,
} from "./use-campus-dashboard";
import { CAMPUS_DASHBOARD_FONT_FAMILY } from "./campus-dashboard-font";
import { CampusDashboardHeaderUtilities } from "./campus-dashboard-header-utilities";
import { HelpChrome } from "@/components/help/help-chrome";

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
type ThreatLevel = UiThreatLevel;

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
interface DashboardIncident {
  id:        string;
  type:      string;
  typeColor: string;
  location:  string;
  building:  string;
  zone:      string;
  ago:       string;
  status:    string;
  priority:  string;
}

interface Responder {
  id:        string;
  initials:  string;
  name:      string;
  zone:      string;
  status:    string;
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
  status:    string;
}

const INCIDENT_TYPE_COLORS: Record<string, string> = {
  MEDICAL: C.red,
  SECURITY: C.amber,
  "MENTAL HEALTH": C.purple,
  "ACTIVE THREAT": C.red,
  MAINTENANCE: C.blue,
  OTHER: C.blue,
};

function mapBuildingUiStatus(
  status: "nominal" | "alert" | "closed",
): Building["status"] {
  if (status === "alert") return "incident";
  if (status === "closed") return "closed";
  return "clear";
}

function mapStaffStatus(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

function zoneAccent(status: string, incidents: number): string {
  if (status === "elevated" || incidents >= 2) return C.amber;
  if (status === "active" || incidents >= 1) return C.orange;
  return C.green;
}

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

function ThreatBanner({ level, canChangeLevel, onChangeLevel, busy }: {
  level: ThreatLevel;
  canChangeLevel: boolean;
  onChangeLevel: (l: ThreatLevel) => void;
  busy?: boolean;
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
      {canChangeLevel ? (
        <div style={{ display: "flex", gap: 4 }}>
          {levels.map((l) => (
            <button
              key={l}
              disabled={busy}
              onClick={() => onChangeLevel(l)}
              style={{
                padding:      "3px 9px",
                borderRadius: 4,
                fontSize:     10,
                fontWeight:   700,
                letterSpacing: "0.04em",
                cursor:       busy ? "wait" : "pointer",
                border:       `1px solid ${THREAT[l].border}`,
                background:   l === level ? THREAT[l].dim : "transparent",
                color:        l === level ? THREAT[l].color : C.textMuted,
                opacity:      busy ? 0.6 : 1,
              }}
            >
              {THREAT[l].label}
            </button>
          ))}
        </div>
      ) : null}
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

function IncidentRow({ incident, href }: { incident: DashboardIncident; href: string }) {
  const statusColors: Record<string, string> = {
    DISPATCHED: C.blue,
    "EN ROUTE": C.amber,
    "ON SCENE":  C.orange,
    CLOSED:      C.textMuted,
  };
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
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
    </Link>
  );
}

function CampusZoneGrid({ zones, linkBase }: { zones: Zone[]; linkBase: string }) {
  return (
    <div style={{ padding: "12px 14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {zones.map((z) => (
          <Link key={z.id} href={`${linkBase}/zones/${encodeURIComponent(z.id)}`} style={{ textDecoration: "none" }}>
          <div
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
          </Link>
        ))}
      </div>
    </div>
  );
}

function ResponderCard({ responder, href }: { responder: Responder; href: string }) {
  const statusColor = RESPONDER_STATUS_COLOR[responder.status] ?? C.textMuted;
  const initials = responder.initials;
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
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
    </Link>
  );
}

function BuildingStatusGrid({ buildings, linkBase }: { buildings: Building[]; linkBase: string }) {
  return (
    <div style={{
      display:             "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
      gap:                 6,
    }}>
      {buildings.map((b) => {
        const s = BUILDING_STATUS[b.status];
        return (
          <Link key={b.id} href={`${linkBase}/buildings/${encodeURIComponent(b.id)}`} style={{ textDecoration: "none" }}>
          <div
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
          </Link>
        );
      })}
    </div>
  );
}

function MassNotifyPanel({
  agencyId,
  canNotify,
  buildings,
  zones,
}: {
  agencyId: string;
  canNotify: boolean;
  buildings: Building[];
  zones: Zone[];
}) {
  const [selected, setSelected] = useState<CampusNotificationBody["audience"] | null>(null);
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"standard" | "emergency">("standard");
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= cooldownUntil) setCooldownUntil(null);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownSeconds =
    cooldownUntil != null ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;

  const audiences: Array<{
    id: CampusNotificationBody["audience"];
    label: string;
    icon: ElementType;
  }> = [
    { id: "all_students", label: "All students", icon: Users },
    { id: "all_staff", label: "All staff", icon: Activity },
    { id: "by_building", label: "By building", icon: Building2 },
    { id: "by_zone", label: "By zone", icon: MapPin },
  ];

  async function sendNotification() {
    if (!selected || !message.trim() || !canNotify) return;
    setNotifyBusy(true);
    setFeedback(null);
    try {
      await postCampusNotification(agencyId, {
        audience: selected,
        message: message.trim(),
        priority,
        buildingId: selected === "by_building" ? targetId : undefined,
        zoneId: selected === "by_zone" ? targetId : undefined,
      });
      setFeedback("Notification queued");
      setMessage("");
      setTargetId("");
      setSelected(null);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Send failed");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function sendBroadcast() {
    if (!broadcastMessage.trim() || !canNotify) return;
    setBroadcastBusy(true);
    setFeedback(null);
    try {
      await postCampusBroadcast(agencyId, {
        message: broadcastMessage.trim(),
        channels: ["sms", "email", "push"],
      });
      setFeedback("Emergency broadcast sent");
      setBroadcastOpen(false);
      setBroadcastMessage("");
    } catch (e) {
      const err = e as Error & { cooldownSeconds?: number };
      if (err.cooldownSeconds) {
        setCooldownUntil(Date.now() + err.cooldownSeconds * 1000);
      }
      setFeedback(err.message ?? "Broadcast failed");
    } finally {
      setBroadcastBusy(false);
    }
  }

  if (!canNotify) {
    return (
      <SidePanel label="MASS NOTIFICATION" icon={Bell}>
        <p style={{ color: C.textSecondary, fontSize: 11, margin: 0 }}>
          Supervisor access required to send notifications.
        </p>
      </SidePanel>
    );
  }

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
              type="button"
              onClick={() => {
                setSelected(selected === a.id ? null : a.id);
                setTargetId("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                background: selected === a.id ? C.blueDim : C.surfaceAlt,
                border: `1px solid ${selected === a.id ? C.blueMid : C.border}`,
                borderRadius: 6,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Icon size={13} color={selected === a.id ? C.blue : C.textSecondary} />
              <span style={{ color: selected === a.id ? C.blue : C.textPrimary, fontSize: 12, fontWeight: 600, flex: 1 }}>
                {a.label}
              </span>
            </button>
          );
        })}

        {selected === "by_building" ? (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{ background: C.surfaceAlt, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11 }}
          >
            <option value="">Select building…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : null}

        {selected === "by_zone" ? (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{ background: C.surfaceAlt, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11 }}
          >
            <option value="">Select zone…</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        ) : null}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Notification message…"
          rows={3}
          style={{ background: C.surfaceAlt, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, fontSize: 11, resize: "vertical" }}
        />

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "standard" | "emergency")}
          style={{ background: C.surfaceAlt, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11 }}
        >
          <option value="standard">Standard priority</option>
          <option value="emergency">Emergency priority</option>
        </select>

        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            disabled={!selected || !message.trim() || notifyBusy || (selected === "by_building" && !targetId) || (selected === "by_zone" && !targetId)}
            onClick={() => void sendNotification()}
            style={{
              padding: "7px",
              background: selected && message.trim() ? C.blueMid : C.bgDeep,
              border: `1px solid ${selected && message.trim() ? C.blue : C.border}`,
              borderRadius: 6,
              color: selected && message.trim() ? "#fff" : C.textMuted,
              fontSize: 11,
              fontWeight: 700,
              cursor: notifyBusy ? "wait" : selected && message.trim() ? "pointer" : "not-allowed",
              letterSpacing: "0.04em",
            }}
          >
            {notifyBusy ? "SENDING…" : "SEND NOTIFICATION"}
          </button>
          <button
            type="button"
            disabled={cooldownSeconds > 0}
            onClick={() => setBroadcastOpen(true)}
            style={{
              padding: "7px",
              background: cooldownSeconds > 0 ? C.bgDeep : "#7f1d1d",
              border: `1px solid ${cooldownSeconds > 0 ? C.border : "#991b1b"}`,
              borderRadius: 6,
              color: cooldownSeconds > 0 ? C.textMuted : "#fca5a5",
              fontSize: 11,
              fontWeight: 700,
              cursor: cooldownSeconds > 0 ? "not-allowed" : "pointer",
              letterSpacing: "0.04em",
            }}
          >
            {cooldownSeconds > 0
              ? `BROADCAST COOLDOWN ${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, "0")}`
              : "⚠ EMERGENCY BROADCAST"}
          </button>
          {feedback ? <span style={{ color: C.silver, fontSize: 10 }}>{feedback}</span> : null}
        </div>
      </div>

      {broadcastOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, width: 360, display: "flex", flexDirection: "column", gap: 10 }}>
            <strong style={{ color: C.red, fontSize: 13 }}>Confirm emergency broadcast</strong>
            <p style={{ color: C.textSecondary, fontSize: 11, margin: 0 }}>
              This sends SMS, email, and push to the entire campus. Limited to 3 per hour.
            </p>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Broadcast message…"
              rows={4}
              style={{ background: C.surfaceAlt, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, fontSize: 11 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setBroadcastOpen(false)} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
              <button
                type="button"
                disabled={!broadcastMessage.trim() || broadcastBusy}
                onClick={() => void sendBroadcast()}
                style={{ padding: "6px 10px", fontSize: 11, fontWeight: 700, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b", borderRadius: 6, cursor: "pointer" }}
              >
                {broadcastBusy ? "Sending…" : "Send broadcast"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

export function CampusSafetyDashboard({
  agencyId,
  agencyName = "Campus",
  agencySlug = "campus",
  linkBase,
  userEmail = "",
  userRole,
}: {
  agencyId: string;
  agencyName?: string;
  agencySlug?: string;
  linkBase?: string;
  userEmail?: string;
  userRole?: string;
}) {
  const base = linkBase ?? `/${agencyId}`;
  const canSupervisor = canCampusSupervisorOps(userRole);
  const [threatBusy, setThreatBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const {
    loading,
    error,
    stats,
    zones: zoneRows,
    buildings: buildingRows,
    onDuty,
    incidents: rawIncidents,
    threatLevel,
    setThreatLevel,
  } = useCampusDashboard(agencyId, agencySlug);

  const incidents: DashboardIncident[] = rawIncidents.map((inc) => {
    const type = mapIncidentType(inc.type);
    return {
      id: inc.id,
      type,
      typeColor: INCIDENT_TYPE_COLORS[type] ?? C.blue,
      location: inc.roomCode || inc.description.slice(0, 40),
      building: inc.buildingLabel,
      zone: inc.zoneLabel || inc.zoneCode || "",
      ago: formatTimeAgo(inc.updatedAt || inc.createdAt),
      status: mapIncidentStatus(inc.status),
      priority: inc.type === "active_threat" ? "CRITICAL" : "MEDIUM",
    };
  });

  const responders: Responder[] = onDuty.map((r) => ({
    id: r.userId,
    initials: r.initials,
    name: r.displayName,
    zone: r.zone,
    status: mapStaffStatus(r.status),
    role: r.role,
  }));

  const buildings: Building[] = buildingRows.map((b) => ({
    id: b.buildingId,
    name: b.buildingName,
    abbr: b.buildingName.slice(0, 6),
    zone: b.zone,
    status: mapBuildingUiStatus(b.status),
    occupancy: b.occupancy,
  }));

  const zones: Zone[] = zoneRows.map((z) => ({
    id: z.zoneId,
    name: z.zoneName,
    color: zoneAccent(z.status, z.incidentCount),
    incidents: z.incidentCount,
    responders: z.responderCount,
    status: z.status,
  }));

  const activeIncidents = incidents.filter((i) => i.status !== "CLOSED");
  const availableRes = responders.filter((r) => r.status === "AVAILABLE").length;

  async function onThreatChange(level: ThreatLevel) {
    setThreatBusy(true);
    try {
      await setThreatLevel(level);
    } finally {
      setThreatBusy(false);
    }
  }

  async function createIncident() {
    const res = await fetch("/api/campus/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campusCode: agencySlug,
        buildingCode: buildings[0]?.id ?? "MAIN",
        type: "security",
        source: "manual",
        description: "Manual incident created from campus dashboard",
        isAnonymous: true,
      }),
    });
    if (!res.ok) throw new Error(`Create failed (${res.status})`);
    setCreateOpen(false);
  }

  return (
    <HelpChrome role={userRole ?? "CAMPUS_SECURITY"}>
    <div style={{
      background: C.bg,
      minHeight:  "100vh",
      display:    "flex",
      flexDirection: "column",
      fontFamily: CAMPUS_DASHBOARD_FONT_FAMILY,
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

        {/* Clock + account */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.textSecondary, fontSize: 12 }}>
            <Clock size={13} />
            <LiveClock />
          </div>
          <CampusDashboardHeaderUtilities
            email={userEmail}
            role={userRole}
            agencyId={agencyId}
          />
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
          {error ? (
            <div style={{ color: C.amber, fontSize: 12, padding: "8px 12px", background: C.amberDim, borderRadius: 6 }}>
              {error}
            </div>
          ) : null}
          <ThreatBanner
            level={threatLevel}
            canChangeLevel={canSupervisor}
            onChangeLevel={(level) => void onThreatChange(level)}
            busy={threatBusy}
          />

          {/* Metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <MetricCard icon={AlertCircle}  label="Active incidents"    value={loading ? "—" : (stats?.activeIncidents ?? activeIncidents.length)} color={C.amber}  dim={C.amberDim}  subtitle={`${activeIncidents.length} open now`} />
            <MetricCard icon={Users}        label="Responders on duty"  value={loading ? "—" : (stats?.respondersOnDuty ?? responders.length)}      color={C.blue}   dim={C.blueDim}   subtitle={`${availableRes} available`} />
            <MetricCard icon={Building2}    label="Buildings monitored" value={loading ? "—" : (stats?.buildingsMonitored ?? buildings.length)}        color={C.green}  dim={C.greenDim}  subtitle="Live building status" />
            <MetricCard icon={Bell}         label="Alerts sent today"   value={loading ? "—" : (stats?.alertsSentToday ?? 0)}                       color={C.purple} dim={C.purpleDim} subtitle="Campus notifications" />
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
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: C.blueDim, border: `1px solid ${C.blueMid}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: C.blue, fontSize: 10, fontWeight: 600 }}
                  >
                    <Plus size={11} /> New
                  </button>
                </div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {incidents.length === 0 ? (
                  <p style={{ color: C.textMuted, fontSize: 11, margin: 0 }}>No open incidents.</p>
                ) : (
                  incidents.map((inc) => (
                    <IncidentRow key={inc.id} incident={inc} href={`${base}/incidents/${encodeURIComponent(inc.id)}`} />
                  ))
                )}
                <Link href={`${base}/incidents`} style={{ color: C.textMuted, fontSize: 11, textAlign: "center", padding: "4px 0", textDecoration: "none" }}>
                  View all incidents →
                </Link>
              </div>
            </div>

            {/* Zone status */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={13} color={C.silver} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.silver, letterSpacing: "0.05em" }}>CAMPUS ZONES</span>
                </div>
                <span style={{ fontSize: 10, color: C.textMuted }}>{zones.length} zones active</span>
              </div>
              <CampusZoneGrid zones={zones} linkBase={base} />
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
              <BuildingStatusGrid buildings={buildings} linkBase={base} />
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
          <MassNotifyPanel agencyId={agencyId} canNotify={canSupervisor} buildings={buildings} zones={zones} />

          {/* Responders */}
          <SidePanel label="ON DUTY" icon={Users}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {responders.slice(0, 5).map((r) => (
                <ResponderCard key={r.id} responder={r} href={`${base}/staff/${encodeURIComponent(r.id)}`} />
              ))}
              {responders.length > 5 ? (
                <div style={{ paddingTop: 8, textAlign: "center" }}>
                  <span style={{ color: C.textMuted, fontSize: 10 }}>+{responders.length - 5} more on duty</span>
                </div>
              ) : null}
            </div>
          </SidePanel>

          {/* Quick actions */}
          <SidePanel label="QUICK ACTIONS" icon={Activity}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { icon: Plus, label: "New incident", action: () => setCreateOpen(true) },
                { icon: Camera, label: "View cameras", href: `${base}/cameras` },
                { icon: MapPin, label: "AED locator", href: `${base}/aed` },
                { icon: Radio, label: "All-call radio", href: `${base}/radio` },
                { icon: FileText, label: "Shift report", href: `${base}/reports` },
              ].map(({ icon: Icon, label, href, action }) => (
                href ? (
                  <Link
                    key={label}
                    href={href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      background: C.surfaceAlt,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.textPrimary,
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    <Icon size={13} color={C.textSecondary} />
                    {label}
                  </Link>
                ) : (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      background: C.surfaceAlt,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      cursor: "pointer",
                      color: C.textPrimary,
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: "left",
                    }}
                  >
                    <Icon size={13} color={C.textSecondary} />
                    {label}
                  </button>
                )
              ))}
            </div>
          </SidePanel>
        </aside>
      </div>

      {createOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, width: 360 }}>
            <strong style={{ color: C.textPrimary, fontSize: 13 }}>Create incident</strong>
            <p style={{ color: C.textSecondary, fontSize: 11 }}>Creates a manual security incident for the default building.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" onClick={() => setCreateOpen(false)} style={{ fontSize: 11 }}>Cancel</button>
              <button
                type="button"
                onClick={() => void createIncident().catch(() => setCreateOpen(false))}
                style={{ fontSize: 11, fontWeight: 700, background: C.blueMid, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </HelpChrome>
  );
}

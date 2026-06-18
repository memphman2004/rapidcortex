"use client";

/**
 * RC Campus — Campus Admin home dashboard (replaces VerticalRoleStub at /app/campus/admin).
 */

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { CAMPUS_DASHBOARD_FONT_FAMILY } from "@/components/campus/campus-dashboard-font";

interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  alert?: boolean;
}

interface QuickAction {
  icon: string;
  label: string;
  desc: string;
  href: string;
  badge?: string;
}

interface SetupStep {
  id: string;
  label: string;
  desc: string;
  done: boolean;
  href: string;
}

interface RecentIncident {
  id: string;
  type: string;
  location: string;
  time: string;
  status: "active" | "resolved" | "monitoring";
}

// Mock data — replace with API fetches when endpoints are ready.
const STATS: StatCard[] = [
  { label: "Active incidents", value: 0, sub: "No active alerts", accent: false },
  { label: "Responders online", value: 0, sub: "No sessions active" },
  { label: "QR zones deployed", value: 0, sub: "Tap to manage" },
  { label: "Users provisioned", value: 1, sub: "0 dispatchers · 1 admin" },
];

function buildSetupSteps(base: string): SetupStep[] {
  return [
    {
      id: "users",
      label: "Add your first responder",
      desc: "Invite campus security officers and dispatchers to the platform.",
      done: false,
      href: `${base}/users`,
    },
    {
      id: "zones",
      label: "Configure campus zones",
      desc: "Add buildings, zones, and named locations for incident tracking.",
      done: false,
      href: `${base}/zones`,
    },
    {
      id: "qr",
      label: "Deploy QR / NFC codes",
      desc: "Generate location codes for buildings, entrances, and emergency stations.",
      done: false,
      href: `${base}/qr-codes`,
    },
    {
      id: "settings",
      label: "Review campus settings",
      desc: "Display name, SMS routing, and notification preferences.",
      done: false,
      href: `${base}/settings`,
    },
    {
      id: "training",
      label: "Run onboarding walkthrough",
      desc: "Schedule the 30-minute dispatcher and admin orientation session.",
      done: false,
      href: "mailto:support@rapidcortex.us?subject=RC%20Campus%20onboarding",
    },
  ];
}

function buildQuickActions(base: string): QuickAction[] {
  return [
    {
      icon: "👥",
      label: "Manage users",
      desc: "Add dispatchers, security officers, and supervisors",
      href: `${base}/users`,
    },
    {
      icon: "🏛️",
      label: "Campus zones",
      desc: "Buildings, areas, and named emergency locations",
      href: `${base}/zones`,
    },
    {
      icon: "⬛",
      label: "QR / NFC codes",
      desc: "Deploy location codes across your campus",
      href: `${base}/qr-codes`,
      badge: "NEW",
    },
    {
      icon: "📊",
      label: "Reports",
      desc: "Incident volume, response times, and SLA compliance",
      href: `${base}/reports`,
    },
    {
      icon: "📱",
      label: "SMS numbers",
      desc: "Campus SMS intake and routing configuration",
      href: "/app/campus/admin/sms-numbers",
    },
    {
      icon: "⚙️",
      label: "Settings",
      desc: "Notification preferences, retention, and compliance",
      href: `${base}/settings`,
    },
  ];
}

const RECENT_INCIDENTS: RecentIncident[] = [];

function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((step) => step.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div style={styles.card}>
      <div style={styles.cardHeaderRow}>
        <div>
          <div style={styles.cardTitle}>Campus setup</div>
          <div style={styles.cardSub}>
            {done} of {steps.length} steps complete
          </div>
        </div>
        <div style={styles.progressPill}>{pct}%</div>
      </div>

      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
      </div>

      <div style={styles.stepList}>
        {steps.map((step, i) => (
          <Link key={step.id} href={step.href} style={{ ...styles.stepRow, textDecoration: "none" }}>
            <div
              style={{
                ...styles.stepCheck,
                background: step.done ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                border: step.done
                  ? "1px solid rgba(16,185,129,0.4)"
                  : "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {step.done ? (
                <span style={{ color: "#10b981", fontSize: 12 }}>✓</span>
              ) : (
                <span style={{ color: "#475569", fontSize: 11, fontWeight: 600 }}>{i + 1}</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: step.done ? "#64748b" : "#e2e8f0",
                  textDecoration: step.done ? "line-through" : "none",
                }}
              >
                {step.label}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{step.desc}</div>
            </div>
            {!step.done && <span style={styles.stepArrow}>→</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Quick access</div>
      <div style={styles.actionsGrid}>
        {actions.map((action) => (
          <Link key={action.href} href={action.href} style={styles.actionCard}>
            <div style={styles.actionIconRow}>
              <span style={styles.actionIcon}>{action.icon}</span>
              {action.badge && <span style={styles.actionBadge}>{action.badge}</span>}
            </div>
            <div style={styles.actionLabel}>{action.label}</div>
            <div style={styles.actionDesc}>{action.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function IncidentFeed({ incidents, base }: { incidents: RecentIncident[]; base: string }) {
  if (incidents.length === 0) {
    return (
      <div style={styles.card}>
        <div style={styles.cardTitle}>Recent incidents</div>
        <div style={styles.emptyFeed}>
          <div style={styles.emptyIcon}>✅</div>
          <div style={styles.emptyText}>No incidents on record</div>
          <div style={styles.emptySub}>
            Incidents will appear here as your team responds to campus events.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeaderRow}>
        <div style={styles.cardTitle}>Recent incidents</div>
        <Link href={`${base}/incidents`} style={styles.seeAll}>
          View all →
        </Link>
      </div>
      {incidents.map((inc) => (
        <div key={inc.id} style={styles.incidentRow}>
          <div
            style={{
              ...styles.statusDot,
              background:
                inc.status === "active"
                  ? "#f87171"
                  : inc.status === "monitoring"
                    ? "#f59e0b"
                    : "#4ade80",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{inc.type}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{inc.location}</div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{inc.time}</div>
        </div>
      ))}
    </div>
  );
}

function PlatformNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div style={styles.notice}>
      <div style={styles.noticeDot} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, color: "#d1fae5", fontWeight: 500 }}>
          RC Campus is live for your organization.
        </span>
        <span style={{ fontSize: 13, color: "#6ee7b7", marginLeft: 8 }}>
          Complete setup to activate incident tracking and responder dispatch.
        </span>
      </div>
      <button type="button" onClick={() => setDismissed(true)} style={styles.noticeDismiss}>
        ✕
      </button>
    </div>
  );
}

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
  const base = `/app/campus/${campusCode}`;
  const setupSteps = useMemo(() => buildSetupSteps(base), [base]);
  const quickActions = useMemo(() => buildQuickActions(base), [base]);

  return (
    <div style={styles.shell}>
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={styles.verticalBadge}>● RC CAMPUS</span>
          <span style={styles.topBarDivider} />
          <span style={styles.topBarAgency}>{agencyName.toUpperCase()}</span>
        </div>
        <div style={styles.topBarRight}>
          <CampusDashboardHeaderUtilities
            email={adminEmail}
            role={adminRole}
            agencyId={agencyId}
          />
        </div>
      </div>

      <div style={styles.body}>
        <PlatformNotice />

        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>{adminName}</h1>
            <p style={styles.pageDesc}>Campus safety intelligence dashboard — {agencyName}</p>
          </div>
          <div style={styles.headerActions}>
            <a href="mailto:support@rapidcortex.us" style={styles.supportLink}>
              Support & training
            </a>
            <Link href={`${base}/incidents`} style={styles.newIncidentBtn}>
              + View incidents
            </Link>
          </div>
        </div>

        <div style={styles.statsGrid}>
          {STATS.map((stat, i) => (
            <div
              key={i}
              style={{
                ...styles.statCard,
                borderColor: stat.alert
                  ? "rgba(248,113,113,0.3)"
                  : stat.accent
                    ? "rgba(16,185,129,0.3)"
                    : "rgba(255,255,255,0.08)",
              }}
            >
              <div style={styles.statLabel}>{stat.label}</div>
              <div
                style={{
                  ...styles.statValue,
                  color: stat.alert ? "#f87171" : stat.accent ? "#34d399" : "#f1f5f9",
                }}
              >
                {stat.value}
              </div>
              {stat.sub && <div style={styles.statSub}>{stat.sub}</div>}
            </div>
          ))}
        </div>

        <div style={styles.contentGrid}>
          <div style={styles.colLeft}>
            <SetupChecklist steps={setupSteps} />
            <IncidentFeed incidents={RECENT_INCIDENTS} base={base} />
          </div>

          <div style={styles.colRight}>
            <QuickActions actions={quickActions} />

            <div style={styles.card}>
              <div style={styles.cardTitle}>Your RC Campus plan</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <div style={styles.planRow}>
                  <span style={styles.planLabel}>Vertical</span>
                  <span style={{ ...styles.verticalBadge, fontSize: 10 }}>RC CAMPUS</span>
                </div>
                <div style={styles.planRow}>
                  <span style={styles.planLabel}>Campus code</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>
                    {campusCode}
                  </span>
                </div>
                <div style={styles.planRow}>
                  <span style={styles.planLabel}>Agency ID</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>
                    {agencyId}
                  </span>
                </div>
                <div style={styles.planRow}>
                  <span style={styles.planLabel}>Platform status</span>
                  <span style={styles.statusOnline}>● Online</span>
                </div>
                <div style={styles.planRow}>
                  <span style={styles.planLabel}>Data region</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>us-east-1</span>
                </div>
              </div>
              <div style={styles.planDivider} />
              <p style={styles.planDisclaimer}>
                RC Campus provides assistive intelligence for campus safety operations. It does not
                replace your existing dispatch, telephony, or security systems. All AI output
                requires human review before any operational action.
              </p>
            </div>

            <div
              style={{
                ...styles.card,
                borderColor: "rgba(16,185,129,0.15)",
                background: "rgba(16,185,129,0.04)",
              }}
            >
              <div style={styles.cardTitle}>Need help getting started?</div>
              <p
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  marginTop: 8,
                  marginBottom: 16,
                  lineHeight: 1.6,
                }}
              >
                Your Rapid Cortex account manager can walk you through setup, CAD integration, and
                dispatcher training in 30–45 minutes.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="mailto:support@rapidcortex.us?subject=RC%20Campus%20walkthrough" style={styles.helpBtn}>
                  Schedule walkthrough
                </a>
                <a
                  href="https://www.rapidcortex.us/product/campus"
                  target="_blank"
                  rel="noreferrer"
                  style={styles.helpBtnSecondary}
                >
                  Docs →
                </a>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <span>Rapid Cortex — Intelligence at the speed of response</span>
          <span style={{ color: "#1e293b" }}>·</span>
          <Link href="/privacy" style={styles.footerLink}>
            Privacy
          </Link>
          <Link href="/terms" style={styles.footerLink}>
            Terms
          </Link>
          <a href="mailto:support@rapidcortex.us" style={styles.footerLink}>
            Support
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  shell: {
    minHeight: "100vh",
    background: "#080e1a",
    color: "#e2e8f0",
    fontFamily: CAMPUS_DASHBOARD_FONT_FAMILY,
  } as CSSProperties,
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    height: 48,
    background: "rgba(0,0,0,0.3)",
    borderBottom: "1px solid rgba(16,185,129,0.15)",
  } as CSSProperties,
  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } as CSSProperties,
  verticalBadge: {
    background: "rgba(16,185,129,0.15)",
    border: "1px solid rgba(16,185,129,0.35)",
    borderRadius: 20,
    color: "#34d399",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.05em",
    padding: "3px 10px",
  } as CSSProperties,
  topBarDivider: {
    width: 1,
    height: 16,
    background: "rgba(255,255,255,0.1)",
    display: "inline-block",
  } as CSSProperties,
  topBarAgency: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    color: "#64748b",
  } as CSSProperties,
  topBarRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  } as CSSProperties,
  body: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px 48px",
  } as CSSProperties,
  notice: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: 8,
    padding: "10px 16px",
    marginBottom: 28,
  } as CSSProperties,
  noticeDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#10b981",
    flexShrink: 0,
  } as CSSProperties,
  noticeDismiss: {
    background: "transparent",
    border: "none",
    color: "#475569",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 4px",
    flexShrink: 0,
  } as CSSProperties,
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    gap: 16,
    flexWrap: "wrap",
  } as CSSProperties,
  pageTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: "#34d399",
    margin: 0,
    marginBottom: 4,
    letterSpacing: "-0.02em",
  } as CSSProperties,
  pageDesc: {
    fontSize: 13,
    color: "#475569",
    margin: 0,
  } as CSSProperties,
  headerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexShrink: 0,
  } as CSSProperties,
  supportLink: {
    color: "#34d399",
    fontSize: 13,
    textDecoration: "none",
  } as CSSProperties,
  newIncidentBtn: {
    background: "#059669",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
  } as CSSProperties,
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginBottom: 24,
  } as CSSProperties,
  statCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "18px 20px",
  } as CSSProperties,
  statLabel: {
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "#475569",
    marginBottom: 10,
  } as CSSProperties,
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    color: "#f1f5f9",
    lineHeight: 1,
    marginBottom: 6,
    fontVariantNumeric: "tabular-nums",
  } as CSSProperties,
  statSub: {
    fontSize: 11,
    color: "#334155",
  } as CSSProperties,
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)",
    gap: 20,
    alignItems: "flex-start",
  } as CSSProperties,
  colLeft: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  } as CSSProperties,
  colRight: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  } as CSSProperties,
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "20px 24px",
  } as CSSProperties,
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  } as CSSProperties,
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#cbd5e1",
    marginBottom: 4,
  } as CSSProperties,
  cardSub: {
    fontSize: 12,
    color: "#475569",
  } as CSSProperties,
  seeAll: {
    fontSize: 12,
    color: "#34d399",
    textDecoration: "none",
  } as CSSProperties,
  progressPill: {
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.25)",
    color: "#34d399",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 10px",
  } as CSSProperties,
  progressTrack: {
    height: 4,
    background: "rgba(255,255,255,0.07)",
    borderRadius: 2,
    margin: "12px 0 16px",
    overflow: "hidden",
  } as CSSProperties,
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #059669, #34d399)",
    borderRadius: 2,
    minWidth: "2%",
    transition: "width 0.6s ease",
  } as CSSProperties,
  stepList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  } as CSSProperties,
  stepRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 8px",
    borderRadius: 8,
    cursor: "pointer",
    color: "inherit",
  } as CSSProperties,
  stepCheck: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as CSSProperties,
  stepArrow: {
    color: "#334155",
    fontSize: 14,
    flexShrink: 0,
  } as CSSProperties,
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginTop: 14,
  } as CSSProperties,
  actionCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 9,
    padding: "14px 14px 12px",
    cursor: "pointer",
    textDecoration: "none",
    display: "block",
  } as CSSProperties,
  actionIconRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  } as CSSProperties,
  actionIcon: {
    fontSize: 18,
  } as CSSProperties,
  actionBadge: {
    background: "rgba(16,185,129,0.15)",
    color: "#34d399",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.05em",
    borderRadius: 3,
    padding: "1px 5px",
  } as CSSProperties,
  actionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#e2e8f0",
    marginBottom: 3,
  } as CSSProperties,
  actionDesc: {
    fontSize: 10,
    color: "#475569",
    lineHeight: 1.4,
  } as CSSProperties,
  emptyFeed: {
    textAlign: "center" as const,
    padding: "32px 0 16px",
  } as CSSProperties,
  emptyIcon: {
    fontSize: 28,
    marginBottom: 12,
  } as CSSProperties,
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: 500,
    marginBottom: 6,
  } as CSSProperties,
  emptySub: {
    fontSize: 12,
    color: "#334155",
    maxWidth: 300,
    margin: "0 auto",
    lineHeight: 1.5,
  } as CSSProperties,
  incidentRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  } as CSSProperties,
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  } as CSSProperties,
  planRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    gap: 12,
  } as CSSProperties,
  planLabel: {
    color: "#475569",
    fontSize: 12,
  } as CSSProperties,
  planDivider: {
    height: 1,
    background: "rgba(255,255,255,0.06)",
    margin: "16px 0",
  } as CSSProperties,
  planDisclaimer: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 1.6,
    margin: 0,
  } as CSSProperties,
  statusOnline: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: 500,
  } as CSSProperties,
  helpBtn: {
    background: "rgba(16,185,129,0.15)",
    border: "1px solid rgba(16,185,129,0.3)",
    borderRadius: 7,
    color: "#34d399",
    fontSize: 12,
    fontWeight: 500,
    padding: "7px 14px",
    textDecoration: "none",
    cursor: "pointer",
  } as CSSProperties,
  helpBtnSecondary: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7,
    color: "#64748b",
    fontSize: 12,
    padding: "7px 14px",
    textDecoration: "none",
  } as CSSProperties,
  footer: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginTop: 48,
    paddingTop: 20,
    borderTop: "1px solid rgba(255,255,255,0.05)",
    fontSize: 11,
    color: "#1e293b",
    flexWrap: "wrap",
  } as CSSProperties,
  footerLink: {
    color: "#334155",
    textDecoration: "none",
    fontSize: 11,
  } as CSSProperties,
};

"use client";

/**
 * CadIntegrationHealthPanel
 *
 * Phase 3 — Admin UI for multi-vendor API poll health observability.
 *
 * Surfaces what was previously invisible:
 *  - auth_error status (credentials need rotation — poller is silently skipping)
 *  - Circuit breaker state (OPEN/HALF_OPEN = no polls happening)
 *  - Last successful poll timestamp + staleness indicator
 *  - Per-integration incident counts and latency
 *  - Force poll trigger (for testing without waiting for schedule)
 *  - Inline credential rotation on auth_error
 *  - Manual circuit reset (sets state = CLOSED, triggers HALF_OPEN trial)
 *
 * API endpoints consumed:
 *   GET    /api/admin/cad-integrations                    — list all
 *   GET    /api/admin/cad-integrations/{id}/metrics       — poll history
 *   POST   /api/admin/cad-integrations/{id}/force-poll    — immediate poll
 *   PATCH  /api/admin/cad-integrations/{id}               — reset CB / rotate creds / status
 *   DELETE /api/admin/cad-integrations/{id}               — remove
 *
 * Role gate: agency_admin | agency_it only. Dispatcher/supervisor never see this.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchCadIntegrationsWithMetrics,
  patchCadIntegration,
  postCadIntegrationForcePoll,
  type CadIntegrationHealthSummary,
} from "@/lib/api";

// ─── Design tokens ────────────────────────────────────────────────────────────

const V = {
  bg:            "#09080f",
  surface:       "#0f0d1a",
  surfaceAlt:    "#141220",
  surfaceHover:  "#1a1730",
  border:        "#1e1a30",
  textPrimary:   "#e4dff5",
  textSecondary: "#9b91bb",
  textMuted:     "#5a4d7a",
  violet:        "#7c3aed",
  green:         "#10b981",
  greenBg:       "#052e16",
  greenBorder:   "#166534",
  amber:         "#f59e0b",
  amberBg:       "#1c0f00",
  amberBorder:   "#92400e",
  red:           "#ef4444",
  redBg:         "#1f0808",
  redBorder:     "#991b1b",
  blue:          "#3b82f6",
  blueBg:        "#0c1a2e",
  blueBorder:    "#1e40af",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationStatus = "active" | "testing" | "inactive" | "error" | "auth_error";
type CBState          = "CLOSED" | "OPEN" | "HALF_OPEN";
type ConnectionType   = "webhook_inbound" | "api_poll";

interface CircuitBreakerInfo {
  state: CBState;
  failureCount: number;
  cooldownUntil?: string;
  openedAt?: string;
}

interface IntegrationSummary extends CadIntegrationHealthSummary {
  connectionType: "webhook_inbound" | "api_poll";
  status: IntegrationStatus;
}

interface PollHistoryPoint {
  ts: string;
  ok: boolean;
  incidentCount: number;
  latencyMs: number;
}

interface Props {
  agencyId: string;
  onEditIntegration?: (integrationId: string) => void;
}

// ─── Status metadata ──────────────────────────────────────────────────────────

const STATUS_META: Record<IntegrationStatus, { label: string; color: string; bg: string; border: string; pulse?: boolean }> = {
  active:     { label: "Active",     color: V.green,  bg: V.greenBg, border: V.greenBorder },
  testing:    { label: "Testing",    color: V.blue,   bg: V.blueBg,  border: V.blueBorder  },
  inactive:   { label: "Inactive",   color: V.textMuted, bg: V.surfaceAlt, border: V.border },
  error:      { label: "Error",      color: V.amber,  bg: V.amberBg, border: V.amberBorder },
  auth_error: { label: "Auth Error", color: V.red,    bg: V.redBg,   border: V.redBorder, pulse: true },
};

const CB_META: Record<CBState, { label: string; color: string }> = {
  CLOSED:    { label: "Circuit closed",    color: V.green },
  OPEN:      { label: "Circuit open",      color: V.red   },
  HALF_OPEN: { label: "Circuit half-open", color: V.amber },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso?: string): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "Just now";
}

function stalenessColor(iso?: string): string {
  if (!iso) return V.red;
  const mins = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (mins < 10) return V.green;
  if (mins < 30) return V.amber;
  return V.red;
}

function miniSparkline(history: PollHistoryPoint[]): string {
  // Returns a simple ASCII-style summary — real impl would use SVG
  const last8 = history.slice(-8);
  return last8.map((p) => (p.ok ? "▪" : "✕")).join(" ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
      borderRadius: 4, padding: "2px 7px",
      animation: meta.pulse ? "pulse 2s infinite" : undefined,
    }}>
      {meta.label}
    </span>
  );
}

function CBBadge({ cb }: { cb?: CircuitBreakerInfo }) {
  if (!cb || cb.state === "CLOSED") return null;
  const meta = CB_META[cb.state];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
      color: meta.color, marginLeft: 6,
    }}>
      ⊙ {meta.label}
      {cb.state === "OPEN" && cb.cooldownUntil && (
        <> · resets {relativeTime(cb.cooldownUntil)}</>
      )}
    </span>
  );
}

// ─── Credential rotation form ─────────────────────────────────────────────────

function CredentialRotationForm({
  integration,
  onSaved,
}: {
  integration: IntegrationSummary;
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  async function save() {
    if (!apiKey.trim()) { setError("New credential is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const body: {
        config: Record<string, unknown>;
        status: "testing";
        circuitBreaker: { state: "CLOSED"; failureCount: 0 };
      } = {
        config: { apiKey: apiKey.trim() },
        status: "testing",
        circuitBreaker: { state: "CLOSED", failureCount: 0 },
      };
      if (apiUrl.trim()) body.config.apiUrl = apiUrl.trim();

      await patchCadIntegration(integration.integrationId, body);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      marginTop: 10, padding: "12px 14px",
      background: V.redBg, border: `1px solid ${V.redBorder}`, borderRadius: 6,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: V.red, marginBottom: 8 }}>
        Credentials rejected — rotate and reset
      </div>
      <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 10 }}>
        The {integration.vendor} API returned 401/403. Update the credential below.
        Saving will reset status to Testing and clear the circuit breaker.
      </div>

      {apiUrl !== undefined && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: V.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            API URL (leave blank to keep current)
          </div>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://cad.agency.gov/api/incidents"
            style={{
              width: "100%", boxSizing: "border-box", padding: "7px 10px",
              background: "#2d0a0a", border: `1px solid ${V.redBorder}`, borderRadius: 5,
              color: V.textPrimary, fontSize: 12, outline: "none",
            }}
          />
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: V.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          New API Key / Token *
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-… or bearer token"
            autoComplete="new-password"
            style={{
              flex: 1, padding: "7px 10px",
              background: "#2d0a0a", border: `1px solid ${V.redBorder}`, borderRadius: 5,
              color: V.textPrimary, fontSize: 12, outline: "none",
              fontFamily: apiKey ? "monospace" : "inherit",
            }}
          />
          <button
            type="button"
            onClick={() => setShowKey((p) => !p)}
            style={{ padding: "7px 10px", background: V.surfaceAlt, border: `1px solid ${V.border}`, borderRadius: 5, color: V.textSecondary, fontSize: 11, cursor: "pointer" }}
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 11, color: V.red, marginBottom: 8 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={saving || !apiKey.trim()}
          onClick={() => void save()}
          style={{
            padding: "8px 16px",
            background: apiKey.trim() ? V.green : V.surfaceAlt,
            border: "none", borderRadius: 5,
            color: apiKey.trim() ? "#052e16" : V.textMuted,
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : "Rotate credentials & reset"}
        </button>
      </div>
    </div>
  );
}

// ─── Integration card ─────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  onRefresh,
  onEditIntegration,
}: {
  integration: IntegrationSummary;
  onRefresh: () => void;
  onEditIntegration?: (integrationId: string) => void;
}) {
  const [expanded, setExpanded] = useState(integration.status === "auth_error");
  const [forcingPoll, setForcingPoll] = useState(false);
  const [resettingCB, setResettingCB] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const isApiPoll = integration.connectionType === "api_poll";
  const cbState   = integration.circuitBreaker?.state ?? "CLOSED";
  const isAuthErr = integration.status === "auth_error";
  const isCBOpen  = cbState === "OPEN" || cbState === "HALF_OPEN";

  async function forcePoll() {
    setForcingPoll(true);
    setActionMsg(null);
    try {
      const data = await postCadIntegrationForcePoll(integration.integrationId);
      if (data.skipped || !data.success) {
        setActionMsg(`✗ ${data.message ?? "Poll failed"}`);
      } else {
        setActionMsg(`✓ ${data.message ?? `Poll complete — ${data.incidentCount} incident(s) received`}`);
        onRefresh();
      }
    } catch (e) {
      setActionMsg(`✗ ${(e as Error).message}`);
    } finally {
      setForcingPoll(false);
    }
  }

  async function resetCircuitBreaker() {
    setResettingCB(true);
    setActionMsg(null);
    try {
      await patchCadIntegration(integration.integrationId, {
        circuitBreaker: { state: "CLOSED", failureCount: 0 },
        ...(integration.status === "error" ? { status: "testing" } : {}),
      });
      setActionMsg("✓ Circuit breaker reset — next scheduled poll will run");
      onRefresh();
    } catch (e) {
      setActionMsg(`✗ ${(e as Error).message}`);
    } finally {
      setResettingCB(false);
    }
  }

  const borderColor = isAuthErr ? V.redBorder
    : isCBOpen ? V.amberBorder
    : integration.status === "active" ? V.greenBorder
    : V.border;

  return (
    <div style={{
      background: V.surface,
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 8,
      overflow: "hidden",
      marginBottom: 10,
    }}>
      {/* Card header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", cursor: "pointer",
          background: isAuthErr ? V.redBg : V.surface,
        }}
        onClick={() => setExpanded((p) => !p)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary }}>
              {integration.name}
            </span>
            <StatusBadge status={integration.status} />
            {isApiPoll && <CBBadge cb={integration.circuitBreaker} />}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: V.textMuted }}>
            <span>{integration.vendor.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>{isApiPoll ? "API poll" : "Webhook inbound"}</span>
            {isApiPoll && (
              <>
                <span>·</span>
                <span style={{ color: stalenessColor(integration.lastSuccessfulPollAt) }}>
                  Last poll: {relativeTime(integration.lastSuccessfulPollAt)}
                </span>
              </>
            )}
            {integration.recentIncidentCount !== undefined && (
              <>
                <span>·</span>
                <span>{integration.recentIncidentCount} incidents (24h)</span>
              </>
            )}
            {integration.avgLatencyMs !== undefined && (
              <>
                <span>·</span>
                <span>avg {integration.avgLatencyMs}ms</span>
              </>
            )}
          </div>
        </div>

        {/* Sparkline */}
        {isApiPoll && integration.pollHistory && integration.pollHistory.length > 0 && (
          <div style={{ fontSize: 11, fontFamily: "monospace", color: V.textMuted, letterSpacing: "0.1em" }}>
            {miniSparkline(integration.pollHistory)}
          </div>
        )}

        <span style={{ color: V.textMuted, fontSize: 14 }}>{expanded ? "▾" : "▸"}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${V.border}` }}>

          {/* auth_error — credential rotation */}
          {isAuthErr && (
            <CredentialRotationForm
              integration={integration}
              onSaved={() => { onRefresh(); setExpanded(false); }}
            />
          )}

          {/* Circuit breaker details */}
          {isApiPoll && integration.circuitBreaker && cbState !== "CLOSED" && (
            <div style={{
              padding: "10px 12px", marginBottom: 12,
              background: V.amberBg, border: `1px solid ${V.amberBorder}`, borderRadius: 6,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: V.amber, marginBottom: 4 }}>
                Circuit breaker {cbState.toLowerCase().replace("_", "-")}
              </div>
              <div style={{ fontSize: 11, color: "#fcd34d" }}>
                {integration.circuitBreaker.failureCount} consecutive failure{integration.circuitBreaker.failureCount !== 1 ? "s" : ""}
                {integration.circuitBreaker.openedAt && (
                  <> · opened {relativeTime(integration.circuitBreaker.openedAt)}</>
                )}
                {cbState === "OPEN" && integration.circuitBreaker.cooldownUntil && (
                  <> · auto-retries {relativeTime(integration.circuitBreaker.cooldownUntil)}</>
                )}
              </div>
            </div>
          )}

          {/* Poll history */}
          {isApiPoll && integration.pollHistory && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: V.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
                Last {integration.pollHistory.length} poll cycles
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {integration.pollHistory.slice(-20).map((p, i) => (
                  <div
                    key={i}
                    title={`${new Date(p.ts).toLocaleTimeString()} · ${p.ok ? `${p.incidentCount} incidents · ${p.latencyMs}ms` : "failed"}`}
                    style={{
                      width: 14, height: 20, borderRadius: 2,
                      background: p.ok
                        ? `rgba(16, 185, 129, ${0.3 + (p.incidentCount > 0 ? 0.5 : 0)})`
                        : "#7f1d1d",
                      cursor: "default",
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 10, color: V.textMuted, marginTop: 4 }}>
                Green = success · Dark red = failure · Hover for details
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isApiPoll && !isAuthErr && (
              <button
                type="button"
                disabled={forcingPoll}
                onClick={() => void forcePoll()}
                style={{
                  padding: "7px 12px", background: V.surfaceAlt,
                  border: `1px solid ${V.border}`, borderRadius: 5,
                  color: V.textSecondary, fontSize: 11, cursor: "pointer",
                }}
              >
                {forcingPoll ? "Polling…" : "Force poll now"}
              </button>
            )}

            {isApiPoll && isCBOpen && !isAuthErr && (
              <button
                type="button"
                disabled={resettingCB}
                onClick={() => void resetCircuitBreaker()}
                style={{
                  padding: "7px 12px",
                  background: V.amberBg, border: `1px solid ${V.amberBorder}`,
                  borderRadius: 5, color: V.amber, fontSize: 11,
                  fontWeight: 700, cursor: "pointer",
                }}
              >
                {resettingCB ? "Resetting…" : "Reset circuit breaker"}
              </button>
            )}

            <button
              type="button"
              style={{
                padding: "7px 12px", background: "transparent",
                border: `1px solid ${V.border}`, borderRadius: 5,
                color: V.textMuted, fontSize: 11, cursor: "pointer",
              }}
              onClick={() => onEditIntegration?.(integration.integrationId)}
            >
              Edit config
            </button>
          </div>

          {actionMsg && (
            <div style={{
              marginTop: 8, fontSize: 11,
              color: actionMsg.startsWith("✓") ? V.green : V.red,
            }}>
              {actionMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function CadIntegrationHealthPanel({ agencyId, onEditIntegration }: Props) {
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "api_poll" | "webhook_inbound">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCadIntegrationsWithMetrics();
      setIntegrations((data.integrations ?? []) as IntegrationSummary[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh every 30s — keeps last-poll staleness current
  useEffect(() => {
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const visible = integrations.filter((i) =>
    filter === "all" ? true : i.connectionType === filter,
  );

  const authErrors    = integrations.filter((i) => i.status === "auth_error").length;
  const circuitOpen   = integrations.filter((i) => (i.circuitBreaker?.state ?? "CLOSED") !== "CLOSED").length;
  const stale         = integrations.filter((i) => {
    if (i.connectionType !== "api_poll") return false;
    if (!i.lastSuccessfulPollAt) return true;
    return Date.now() - new Date(i.lastSuccessfulPollAt).getTime() > 30 * 60_000;
  }).length;

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Alert bar — only shown when action required */}
      {(authErrors > 0 || circuitOpen > 0 || stale > 0) && (
        <div style={{
          display: "flex", gap: 10, padding: "10px 14px", marginBottom: 14,
          background: authErrors > 0 ? V.redBg : V.amberBg,
          border: `1px solid ${authErrors > 0 ? V.redBorder : V.amberBorder}`,
          borderRadius: 7, flexWrap: "wrap",
        }}>
          {authErrors > 0 && (
            <span style={{ fontSize: 12, color: V.red, fontWeight: 700 }}>
              ⚠ {authErrors} integration{authErrors > 1 ? "s" : ""} with auth errors — credentials need rotation
            </span>
          )}
          {circuitOpen > 0 && (
            <span style={{ fontSize: 12, color: V.amber }}>
              ⊙ {circuitOpen} circuit breaker{circuitOpen > 1 ? "s" : ""} open
            </span>
          )}
          {stale > 0 && (
            <span style={{ fontSize: 12, color: V.amber }}>
              ⏱ {stale} stale poll{stale > 1 ? "s" : ""} ({">"}30 min)
            </span>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "api_poll", "webhook_inbound"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px",
                background: filter === f ? V.surfaceAlt : "transparent",
                border: `1px solid ${filter === f ? V.border : "transparent"}`,
                borderRadius: 5, color: filter === f ? V.textPrimary : V.textMuted,
                fontSize: 11, cursor: "pointer",
              }}
            >
              {f === "all" ? `All (${integrations.length})` :
               f === "api_poll" ? `API Poll (${integrations.filter((i) => i.connectionType === "api_poll").length})` :
               `Webhook (${integrations.filter((i) => i.connectionType === "webhook_inbound").length})`}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => void load()}
          style={{
            padding: "6px 12px", background: "transparent",
            border: `1px solid ${V.border}`, borderRadius: 5,
            color: V.textMuted, fontSize: 11, cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ padding: 20, textAlign: "center", color: V.textMuted, fontSize: 12 }}>
          Loading integrations…
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 12px", background: V.redBg, border: `1px solid ${V.redBorder}`, borderRadius: 6, fontSize: 12, color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div style={{
          padding: 24, textAlign: "center",
          border: `1px dashed ${V.border}`, borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, color: V.textMuted, marginBottom: 8 }}>
            No integrations configured
          </div>
          <div style={{ fontSize: 11, color: V.textMuted }}>
            Use the "New Integration" button to add a CAD connection.
          </div>
        </div>
      )}

      {!loading && visible.map((i) => (
        <IntegrationCard
          key={i.integrationId}
          integration={i}
          onRefresh={() => void load()}
          onEditIntegration={onEditIntegration}
        />
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

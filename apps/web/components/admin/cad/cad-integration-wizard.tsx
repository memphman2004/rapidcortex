"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { CadVendor } from "rapid-cortex-shared";
import {
  fetchCadIncidents,
  patchCadIntegration,
  postCadIntegration,
  postCadIntegrationTest,
} from "@/lib/api";
import {
  CAD_VENDORS,
  buildFieldMappingConfig,
  type CadConnectionType,
  type CadVendorDefinition,
  type CadVendorId,
} from "@/lib/cad/cad-vendor-definitions";
import { extractCadPreview } from "./cad-admin-ui-helpers";
import { CadApiPollCredentialsStep, type ApiPollCredentials } from "./cad-api-poll-credentials-step";
import { CadFieldMappingStep, type FieldMappingOutput } from "./cad-field-mapping-step";

const V = {
  bg: "#09080f",
  surface: "#0f0d1a",
  surfaceAlt: "#141220",
  border: "#1e1a30",
  textPrimary: "#e4dff5",
  textSecondary: "#9b91bb",
  textMuted: "#5a4d7a",
  violet: "#7c3aed",
  violetHover: "#6d28d9",
  green: "#10b981",
  greenBg: "#052e16",
  greenBorder: "#166534",
  amber: "#f59e0b",
  red: "#ef4444",
  redBg: "#1f0808",
  redBorder: "#991b1b",
} as const;

const STEPS = [
  { id: 1, label: "Vendor" },
  { id: 2, label: "Connection" },
  { id: 3, label: "Credentials" },
  { id: 4, label: "Field Mapping" },
  { id: 5, label: "Test" },
  { id: 6, label: "Go Live" },
] as const;

interface IntegrationState {
  integrationId: string | null;
  webhookUrl: string | null;
  token: string | null;
  status: "testing" | "active" | "inactive" | "error";
}

interface WizardProps {
  agencyId: string;
  onComplete?: (integrationId: string) => void;
  onClose?: () => void;
}

interface LiveIncidentRow {
  incidentId: string;
  cadEventId: string;
  incidentType: string;
  location: string;
  receivedAt: string;
}

export function CadIntegrationWizard({ agencyId, onComplete, onClose }: WizardProps) {
  const [step, setStep] = useState(1);
  const [vendorId, setVendorId] = useState<CadVendorId | null>(null);
  const [connectionType, setConnectionType] = useState<CadConnectionType>("webhook_inbound");
  const [integrationName, setIntegrationName] = useState("");
  const [fieldMappingOutput, setFieldMappingOutput] = useState<FieldMappingOutput | null>(null);
  const [pollCreds, setPollCreds] = useState<ApiPollCredentials | null>(null);
  const [savedConfig, setSavedConfig] = useState<Record<string, unknown>>({});
  const [integration, setIntegration] = useState<IntegrationState>({
    integrationId: null,
    webhookUrl: null,
    token: null,
    status: "testing",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [goLiveConfirmed, setGoLiveConfirmed] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);

  const vendor = vendorId ? (CAD_VENDORS.find((v) => v.id === vendorId) ?? null) : null;

  useEffect(() => {
    if (!vendor) return;
    setConnectionType(vendor.recommendedConnectionType);
    setIntegrationName(`${vendor.label} Integration`);
  }, [vendor]);

  async function patchMergedConfig(partial: Record<string, unknown>): Promise<boolean> {
    if (!integration.integrationId) return false;
    const next = { ...savedConfig, ...partial };
    try {
      const res = await patchCadIntegration(integration.integrationId, { config: next });
      if (res.integration) setSavedConfig((res.integration.config as Record<string, unknown>) ?? next);
      else setSavedConfig(next);
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save configuration");
      return false;
    }
  }

  async function createIntegration(): Promise<boolean> {
    if (!vendor) return false;
    setSaving(true);
    setSaveError(null);
    try {
      if (integration.integrationId) return true;

      const res = await postCadIntegration({
        vendor: vendor.id as CadVendor,
        connectionType,
        name: integrationName.trim() || `${vendor.label} Integration`,
        config: {},
      });

      setSavedConfig(res.integration.config ?? {});
      setIntegration({
        integrationId: res.integration.id,
        webhookUrl: res.integration.webhookUrl,
        token: res.webhookSecret,
        status: "testing",
      });
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to create integration");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function savePollCredentials(): Promise<boolean> {
    if (!pollCreds || connectionType !== "api_poll") return true;
    return patchMergedConfig({
      apiUrl: pollCreds.apiUrl.trim(),
      authType: pollCreds.authType,
      ...(pollCreds.apiKey ? { apiKey: pollCreds.apiKey } : {}),
      apiKeyHeader: pollCreds.apiKeyHeader,
      agencyCode: pollCreds.agencyCode.trim(),
      pollIntervalMinutes: pollCreds.pollIntervalMinutes,
    });
  }

  async function saveFieldMapping(): Promise<boolean> {
    if (!fieldMappingOutput) return true;
    return patchMergedConfig(buildFieldMappingConfig(fieldMappingOutput.rows, fieldMappingOutput.priorityMapping));
  }

  async function sendTest(): Promise<void> {
    if (!integration.integrationId) return;
    setTestSending(true);
    setTestError(null);
    try {
      await postCadIntegrationTest(integration.integrationId);
      setTestSent(true);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestSending(false);
    }
  }

  async function activateIntegration(): Promise<void> {
    if (!integration.integrationId || !goLiveConfirmed) return;
    setActivating(true);
    try {
      await patchCadIntegration(integration.integrationId, { status: "active" });
      setIntegration((prev) => ({ ...prev, status: "active" }));
      onComplete?.(integration.integrationId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  async function handleNext(): Promise<void> {
    setSaveError(null);
    if (step === 2) {
      const ok = await createIntegration();
      if (!ok) return;
    }
    if (step === 3 && connectionType === "api_poll") {
      const ok = await savePollCredentials();
      if (!ok) return;
    }
    if (step === 4) {
      const ok = await saveFieldMapping();
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, 6));
  }

  function handleBack(): void {
    setSaveError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  function canAdvance(): boolean {
    if (step === 1) return !!vendorId;
    if (step === 2) return !!integrationName.trim();
    if (step === 3 && connectionType === "api_poll") return !!pollCreds?.apiUrl.trim();
    return true;
  }

  const handleFirstIncident = useCallback(() => setGoLiveConfirmed(true), []);

  const webhookUrl =
    integration.webhookUrl ??
    `https://api.rapidcortex.us/api/cad/webhook/${agencyId}/${integration.integrationId ?? "{integrationId}"}`;

  return (
    <div
      style={{
        background: V.surface,
        border: `1px solid ${V.border}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 20px",
          borderBottom: `1px solid ${V.border}`,
          background: V.bg,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: V.textPrimary }}>CAD Integration Setup</div>
          <div style={{ fontSize: 11, color: V.textMuted, marginTop: 2 }}>
            {vendor ? vendor.fullName : "Configure a new CAD connection"}
          </div>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: V.textMuted, fontSize: 18, cursor: "pointer" }}>
            ×
          </button>
        ) : null}
      </div>

      <StepTrack current={step} />

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {step === 1 ? (
          <div>
            <SectionLabel>Select CAD Vendor</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {CAD_VENDORS.map((v) => (
                <VendorCard key={v.id} vendor={v} selected={vendorId === v.id} onClick={() => setVendorId(v.id)} />
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 && vendor ? (
          <div>
            <SectionLabel>Connection Method</SectionLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {vendor.supportedConnectionTypes.map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setConnectionType(ct)}
                  style={{
                    flex: 1,
                    padding: "12px 10px",
                    background: connectionType === ct ? "#1a1040" : V.surfaceAlt,
                    border: `1px solid ${connectionType === ct ? V.violet : V.border}`,
                    borderRadius: 7,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{ct === "webhook_inbound" ? "🔗" : ct === "api_poll" ? "🔄" : "📡"}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: connectionType === ct ? V.textPrimary : V.textSecondary }}>
                    {ct === "webhook_inbound" ? "Webhook Inbound" : ct === "api_poll" ? "API Poll" : "TCP Feed"}
                  </div>
                  {vendor.recommendedConnectionType === ct ? (
                    <div style={{ marginTop: 5, fontSize: 10, color: V.green, fontWeight: 700 }}>RECOMMENDED</div>
                  ) : null}
                </button>
              ))}
            </div>
            <SectionLabel>Integration Name</SectionLabel>
            <input
              type="text"
              value={integrationName}
              onChange={(e) => setIntegrationName(e.target.value)}
              placeholder={`${vendor.label} Integration`}
              style={inputStyle}
            />
          </div>
        ) : null}

        {step === 3 && vendor ? (
          <div>
            {connectionType === "webhook_inbound" ? (
              <>
                <SectionLabel>Webhook Endpoint</SectionLabel>
                <div style={{ fontSize: 11, color: V.textSecondary, marginBottom: 14, padding: "10px 12px", background: "#0c0a18", borderLeft: `3px solid ${V.violet}`, borderRadius: 5 }}>
                  {vendor.vendorWebhookNotes}
                </div>
                <FieldRow label="Webhook URL" value={webhookUrl} copyLabel="URL" />
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: V.textMuted, marginBottom: 5 }}>AUTHENTICATION HEADER</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    <div style={{ ...inputStyle, flexShrink: 0, width: 120, fontFamily: "monospace" }}>X-RC-Token:</div>
                    <CodeBlock value={integration.token ?? "(created on Next — token shown once)"} />
                    {integration.token ? <CopyButton value={integration.token} label="Token" /> : null}
                  </div>
                  <div style={{ fontSize: 10, color: V.amber, marginTop: 6 }}>
                    Token shown once — store securely before leaving this page.
                  </div>
                </div>
                <CollapsibleInstructions
                  open={showSetupInstructions}
                  onToggle={() => setShowSetupInstructions((p) => !p)}
                  vendorLabel={vendor.label}
                  text={vendor.setupInstructions}
                />
              </>
            ) : (
              <CadApiPollCredentialsStep
                vendor={vendor}
                integrationId={integration.integrationId ?? undefined}
                onChange={setPollCreds}
              />
            )}
          </div>
        ) : null}

        {step === 4 && vendor ? (
          <CadFieldMappingStep vendor={vendor} initial={fieldMappingOutput ?? undefined} onChange={setFieldMappingOutput} />
        ) : null}

        {step === 5 ? (
          <div>
            <SectionLabel>Test Integration</SectionLabel>
            <div style={{ background: V.surfaceAlt, border: `1px solid ${V.border}`, borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: V.textPrimary }}>
                    {connectionType === "webhook_inbound" ? "Send test webhook payload" : "Trigger test API poll"}
                  </div>
                  <div style={{ fontSize: 11, color: V.textMuted, marginTop: 3 }}>
                    Verifies end-to-end delivery through the CAD ingress pipeline.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={testSending || testSent || !integration.integrationId}
                  onClick={() => void sendTest()}
                  style={{
                    padding: "9px 18px",
                    background: testSent ? V.greenBg : V.violet,
                    border: `1px solid ${testSent ? V.greenBorder : V.violetHover}`,
                    borderRadius: 6,
                    color: testSent ? V.green : "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {testSending ? "Sending…" : testSent ? "Sent" : "Send test"}
                </button>
              </div>
              {testError ? (
                <div style={{ marginTop: 10, padding: "8px 10px", background: V.redBg, border: `1px solid ${V.redBorder}`, borderRadius: 5, fontSize: 11, color: "#fca5a5" }}>
                  {testError}
                </div>
              ) : null}
            </div>
            {integration.integrationId ? (
              <>
                <SectionLabel>Live Incident Log</SectionLabel>
                <GoLiveProof integrationId={integration.integrationId} onFirstIncident={handleFirstIncident} />
              </>
            ) : null}
          </div>
        ) : null}

        {step === 6 ? (
          <div>
            {integration.status === "active" ? (
              <div style={{ background: V.greenBg, border: `1px solid ${V.greenBorder}`, borderRadius: 10, padding: "20px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#86efac" }}>Integration is live</div>
                <div style={{ fontSize: 12, color: "#4ade80", marginTop: 6 }}>
                  {vendor?.label} CAD incidents are flowing into Rapid Cortex.
                </div>
              </div>
            ) : (
              <div>
                <SectionLabel>Activate Integration</SectionLabel>
                <Checklist
                  items={[
                    { label: "Integration record created", done: !!integration.integrationId },
                    { label: "Field mapping saved", done: !!fieldMappingOutput },
                    { label: "Test payload sent or received", done: testSent || goLiveConfirmed },
                    { label: "First real incident verified (recommended)", done: goLiveConfirmed },
                  ]}
                />
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "14px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={goLiveConfirmed} onChange={(e) => setGoLiveConfirmed(e.target.checked)} />
                  <span style={{ fontSize: 12, color: V.textSecondary, lineHeight: 1.5 }}>
                    I confirm this integration is ready for production. Activating begins processing live CAD incidents.
                  </span>
                </label>
                <button
                  type="button"
                  disabled={!goLiveConfirmed || activating || !integration.integrationId}
                  onClick={() => void activateIntegration()}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    background: goLiveConfirmed ? V.green : V.surfaceAlt,
                    border: `1px solid ${goLiveConfirmed ? V.greenBorder : V.border}`,
                    borderRadius: 7,
                    color: goLiveConfirmed ? "#052e16" : V.textMuted,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {activating ? "Activating…" : "Activate Integration"}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {saveError ? (
          <div style={{ marginTop: 12, padding: "10px 12px", background: V.redBg, border: `1px solid ${V.redBorder}`, borderRadius: 6, fontSize: 12, color: "#fca5a5" }}>
            {saveError}
          </div>
        ) : null}
        <div style={{ height: 70 }} />
      </div>

      {step < 6 ? (
        <div style={{ borderTop: `1px solid ${V.border}`, background: V.bg, padding: "12px 20px", display: "flex", gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={handleBack} disabled={step === 1 || saving} style={backBtnStyle}>
            ← Back
          </button>
          <div style={{ flex: 1, fontSize: 10, color: V.textMuted, alignSelf: "center" }}>
            Step {step} of {STEPS.length}
          </div>
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={!canAdvance() || saving}
            style={{
              padding: "9px 22px",
              background: canAdvance() && !saving ? V.violet : V.surfaceAlt,
              border: `1px solid ${canAdvance() ? V.violetHover : V.border}`,
              borderRadius: 6,
              color: canAdvance() ? "#fff" : V.textMuted,
              fontSize: 13,
              fontWeight: 700,
              cursor: canAdvance() ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving…" : step === 5 ? "Continue to Go Live →" : "Next →"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GoLiveProof({ integrationId, onFirstIncident }: { integrationId: string; onFirstIncident: () => void }) {
  const [incidents, setIncidents] = useState<LiveIncidentRow[]>([]);
  const [pollCount, setPollCount] = useState(0);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      while (!cancelled) {
        try {
          const data = await fetchCadIncidents({ integrationId, limit: 5, since: new Date(Date.now() - 7 * 86_400_000).toISOString() });
          if (cancelled) return;
          const rows: LiveIncidentRow[] = (data.items ?? []).map((item) => {
            const preview = extractCadPreview(item.rawBody);
            return {
              incidentId: item.id,
              cadEventId: preview.cadNumber,
              incidentType: preview.callType,
              location: preview.location,
              receivedAt: item.receivedAt,
            };
          });
          setIncidents(rows);
          setPollCount((n) => n + 1);
          if (rows.length > 0 && !notifiedRef.current) {
            notifiedRef.current = true;
            onFirstIncident();
          }
        } catch {
          // transient
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [integrationId, onFirstIncident]);

  return (
    <div>
      <div style={{ fontSize: 12, color: V.textSecondary, marginBottom: 12 }}>
        {incidents.length > 0
          ? `${incidents.length} incident(s) received`
          : `Waiting for first CAD incident… (polled ${pollCount} time${pollCount !== 1 ? "s" : ""}, refresh every 4s)`}
      </div>
      {incidents.length === 0 ? (
        <div style={{ border: `1px dashed ${V.border}`, borderRadius: 6, padding: "20px 14px", textAlign: "center", color: V.textMuted, fontSize: 12 }}>
          Trigger a test dispatch in your CAD system or use Send test above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {incidents.map((inc) => (
            <div key={inc.incidentId} style={{ padding: "8px 12px", background: V.greenBg, border: `1px solid ${V.greenBorder}`, borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#86efac" }}>
                {inc.cadEventId} · {inc.incidentType}
              </div>
              <div style={{ fontSize: 11, color: "#4ade80" }}>{inc.location}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepTrack({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "14px 20px 12px", borderBottom: `1px solid ${V.border}`, overflowX: "auto", flexShrink: 0 }}>
      {STEPS.map((s, i) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: s.id < current ? V.green : s.id === current ? V.violet : V.surfaceAlt,
                border: `1px solid ${s.id <= current ? (s.id < current ? V.green : V.violet) : V.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: s.id <= current ? "#fff" : V.textMuted,
              }}
            >
              {s.id < current ? "✓" : s.id}
            </div>
            <span style={{ fontSize: 11, fontWeight: s.id === current ? 700 : 400, color: s.id === current ? V.textPrimary : s.id < current ? V.green : V.textMuted }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 ? <div style={{ width: 24, height: 1, background: s.id < current ? V.green : V.border, margin: "0 6px" }} /> : null}
        </div>
      ))}
    </div>
  );
}

function VendorCard({ vendor, selected, onClick }: { vendor: CadVendorDefinition; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 12px", background: selected ? "#1a1040" : V.surfaceAlt, border: `1px solid ${selected ? V.violet : V.border}`, borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 6, background: selected ? "#2e1065" : V.bg, border: `1px solid ${selected ? V.violet : V.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: selected ? "#c4b5fd" : V.textMuted }}>
          {vendor.logoText}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: selected ? V.textPrimary : V.textSecondary }}>{vendor.label}</div>
          {vendor.id === "console_one" ? (
            <span style={{ fontSize: 9, fontWeight: 700, color: V.green, background: V.greenBg, border: `1px solid ${V.greenBorder}`, borderRadius: 3, padding: "1px 5px" }}>
              NEW
            </span>
          ) : null}
        </div>
      </div>
      <div style={{ fontSize: 11, color: V.textMuted, lineHeight: 1.4 }}>{vendor.description}</div>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: V.textMuted, borderBottom: `1px solid ${V.border}`, paddingBottom: 5, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div style={{ flex: 1, background: "#080610", border: `1px solid ${V.border}`, borderRadius: 5, padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#a78bfa", wordBreak: "break-all" }}>
      {value}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{ padding: "7px 12px", background: copied ? V.greenBg : V.surfaceAlt, border: `1px solid ${copied ? V.greenBorder : V.border}`, borderRadius: 5, color: copied ? V.green : V.textSecondary, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
    >
      {copied ? "Copied" : `Copy ${label}`}
    </button>
  );
}

function FieldRow({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: V.textMuted, marginBottom: 5 }}>{label.toUpperCase()}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <CodeBlock value={value} />
        <CopyButton value={value} label={copyLabel} />
      </div>
    </div>
  );
}

function CollapsibleInstructions({ open, onToggle, vendorLabel, text }: { open: boolean; onToggle: () => void; vendorLabel: string; text: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" onClick={onToggle} style={{ background: "none", border: "none", color: V.textSecondary, cursor: "pointer", fontSize: 12 }}>
        {open ? "▾" : "▸"} {vendorLabel} setup instructions (for agency IT)
      </button>
      {open ? <pre style={{ marginTop: 8, padding: "12px 14px", background: "#080610", border: `1px solid ${V.border}`, borderRadius: 6, fontSize: 11, color: V.textSecondary, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{text}</pre> : null}
    </div>
  );
}

function Checklist({ items }: { items: Array<{ label: string; done: boolean }> }) {
  return (
    <div style={{ background: V.surfaceAlt, border: `1px solid ${V.border}`, borderRadius: 8, padding: "14px 16px" }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 7 }}>
          <span style={{ color: item.done ? V.green : V.textMuted }}>{item.done ? "✓" : "○"}</span>
          <span style={{ fontSize: 12, color: item.done ? V.textPrimary : V.textMuted }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  background: V.surfaceAlt,
  border: `1px solid ${V.border}`,
  borderRadius: 6,
  color: V.textPrimary,
  fontSize: 13,
  outline: "none",
};

const backBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  border: `1px solid ${V.border}`,
  borderRadius: 6,
  color: V.textSecondary,
  fontSize: 13,
  cursor: "pointer",
};

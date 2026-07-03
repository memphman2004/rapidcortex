"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { postCadIntegrationTestConnection, type CadPollTestConnectionBody } from "@/lib/api";
import type { CadVendorDefinition } from "@/lib/cad/cad-vendor-definitions";

const V = {
  surfaceAlt: "#141220",
  border: "#1e1a30",
  textPrimary: "#e4dff5",
  textSecondary: "#9b91bb",
  textMuted: "#5a4d7a",
  violet: "#7c3aed",
  green: "#10b981",
  greenBg: "#052e16",
  greenBorder: "#166534",
  red: "#ef4444",
  redBg: "#1f0808",
  redBorder: "#991b1b",
} as const;

const inputStyle: CSSProperties = {
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

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: V.textMuted,
  marginBottom: 5,
};

export type AuthType = CadPollTestConnectionBody["authType"];

export interface ApiPollCredentials {
  apiUrl: string;
  authType: AuthType;
  apiKey: string;
  apiKeyHeader: string;
  agencyCode: string;
  pollIntervalMinutes: number;
}

export interface TestConnectionResult {
  ok: boolean;
  latencyMs?: number;
  sampleCount?: number;
  error?: string;
  statusCode?: number;
}

interface Props {
  vendor: CadVendorDefinition;
  integrationId?: string;
  initial?: Partial<ApiPollCredentials>;
  onChange: (creds: ApiPollCredentials) => void;
  onCredentialsSaved?: () => void;
}

function validateUrl(url: string): string | null {
  if (!url.trim()) return "API URL is required";
  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return "URL must use http or https";
    if (parsed.protocol === "http:" && !url.includes("localhost") && !url.includes("127.0.0.1")) {
      return "Production API URLs must use HTTPS";
    }
    return null;
  } catch {
    return "Invalid URL format";
  }
}

const POLL_INTERVALS = [
  { value: 1, label: "Every 1 minute" },
  { value: 2, label: "Every 2 minutes (recommended)" },
  { value: 5, label: "Every 5 minutes" },
  { value: 10, label: "Every 10 minutes" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
];

export function CadApiPollCredentialsStep({
  vendor,
  integrationId,
  initial,
  onChange,
  onCredentialsSaved,
}: Props) {
  const suggested = vendor.suggestedPollIntervalMinutes ?? 2;

  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? "");
  const [authType, setAuthType] = useState<AuthType>(initial?.authType ?? "bearer");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [apiKeyHeader, setApiKeyHeader] = useState(initial?.apiKeyHeader ?? "X-Api-Key");
  const [agencyCode, setAgencyCode] = useState(initial?.agencyCode ?? "");
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(initial?.pollIntervalMinutes ?? suggested);
  const [showKey, setShowKey] = useState(false);
  const [savedMasked, setSavedMasked] = useState<string | null>(
    initial?.apiKey && initial.apiKey.length >= 8 ? `****${initial.apiKey.slice(-4)}` : null,
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  const emit = useCallback(
    (fields: Partial<ApiPollCredentials> = {}) => {
      onChange({
        apiUrl,
        authType,
        apiKey,
        apiKeyHeader,
        agencyCode,
        pollIntervalMinutes,
        ...fields,
      });
    },
    [agencyCode, apiKey, apiKeyHeader, apiUrl, authType, onChange, pollIntervalMinutes],
  );

  async function testConnection(): Promise<void> {
    if (!integrationId) {
      setTestResult({ ok: false, error: "Save the integration first to enable test connection" });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const body: CadPollTestConnectionBody = {
        apiUrl: apiUrl.trim(),
        authType,
        apiKeyHeader,
        agencyCode: agencyCode.trim(),
        ...(apiKey && !savedMasked ? { apiKey } : {}),
      };
      const data = await postCadIntegrationTestConnection(integrationId, body);
      setTestResult(data);
      if (data.ok && apiKey && !savedMasked) {
        setSavedMasked(`****${apiKey.slice(-4)}`);
        onCredentialsSaved?.();
      }
    } catch (e) {
      setTestResult({
        ok: false,
        error: e instanceof Error ? e.message : "Network error — check console",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      {vendor.knownApiEndpointPattern ? (
        <div
          style={{
            background: "#0c0a18",
            border: `1px solid ${V.border}`,
            borderLeft: `3px solid ${V.violet}`,
            borderRadius: 5,
            padding: "9px 12px",
            marginBottom: 18,
            fontSize: 11,
            color: V.textSecondary,
          }}
        >
          <span style={{ fontWeight: 700, color: V.textPrimary }}>Expected endpoint pattern: </span>
          <code style={{ fontFamily: "monospace", color: "#a78bfa" }}>{vendor.knownApiEndpointPattern}</code>
        </div>
      ) : null}

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>API Endpoint URL *</label>
        <input
          type="url"
          placeholder={vendor.knownApiEndpointPattern ?? "https://cad.agency.gov/api/incidents"}
          value={apiUrl}
          onChange={(e) => {
            setApiUrl(e.target.value);
            setUrlError(null);
            emit({ apiUrl: e.target.value });
          }}
          onBlur={() => setUrlError(validateUrl(apiUrl))}
          style={{ ...inputStyle, borderColor: urlError ? V.red : V.border }}
          aria-required="true"
        />
        {urlError ? <div style={{ fontSize: 11, color: V.red, marginTop: 3 }}>{urlError}</div> : null}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Authentication Method *</label>
        <select
          value={authType}
          onChange={(e) => {
            setAuthType(e.target.value as AuthType);
            emit({ authType: e.target.value as AuthType });
          }}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="bearer">Bearer Token (Authorization: Bearer …)</option>
          <option value="api_key_header">API Key Header (custom header name)</option>
          <option value="basic">HTTP Basic Auth (username:password base64)</option>
          <option value="no_auth">No Authentication (IP allowlist only)</option>
        </select>
      </div>

      {authType === "api_key_header" ? (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Header Name</label>
          <input
            type="text"
            placeholder="X-Api-Key"
            value={apiKeyHeader}
            onChange={(e) => {
              setApiKeyHeader(e.target.value);
              emit({ apiKeyHeader: e.target.value });
            }}
            style={inputStyle}
          />
        </div>
      ) : null}

      {authType !== "no_auth" ? (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>
            {authType === "bearer" ? "Bearer Token" : authType === "basic" ? "Credentials (base64)" : "API Key"}
          </label>
          {savedMasked ? (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ ...inputStyle, flex: 1, fontFamily: "monospace", color: V.textMuted }}>{savedMasked}</div>
              <button
                type="button"
                onClick={() => {
                  setSavedMasked(null);
                  setApiKey("");
                }}
                style={secondaryBtnStyle}
              >
                Replace
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type={showKey ? "text" : "password"}
                placeholder={authType === "basic" ? "dXNlcjpwYXNz…" : "sk-…"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  emit({ apiKey: e.target.value });
                }}
                autoComplete="new-password"
                style={{ ...inputStyle, flex: 1, fontFamily: apiKey ? "monospace" : "inherit" }}
              />
              <button type="button" onClick={() => setShowKey((p) => !p)} style={secondaryBtnStyle}>
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          )}
          <div style={{ fontSize: 10, color: V.textMuted, marginTop: 3 }}>
            Stored in integration config. For production, consider AWS Secrets Manager (contact RC ops).
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Agency Code</label>
        <input
          type="text"
          placeholder="PVPD, COUNTY-911, etc."
          value={agencyCode}
          onChange={(e) => {
            setAgencyCode(e.target.value);
            emit({ agencyCode: e.target.value });
          }}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Poll Interval</label>
        <select
          value={pollIntervalMinutes}
          onChange={(e) => {
            const v = Number(e.target.value);
            setPollIntervalMinutes(v);
            emit({ pollIntervalMinutes: v });
          }}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          {POLL_INTERVALS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: V.surfaceAlt,
          border: `1px solid ${V.border}`,
          borderRadius: 8,
          padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: testResult ? 10 : 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: V.textPrimary }}>Test Connection</div>
            <div style={{ fontSize: 11, color: V.textMuted, marginTop: 2 }}>
              {integrationId
                ? "Sends a live poll request using the credentials above."
                : "Save the integration first to enable live test."}
            </div>
          </div>
          <button
            type="button"
            disabled={testing || !integrationId || !apiUrl.trim()}
            onClick={() => void testConnection()}
            style={{
              padding: "8px 16px",
              background: testing ? V.surfaceAlt : integrationId ? V.violet : "#1e1a30",
              border: `1px solid ${integrationId ? V.violet : V.border}`,
              borderRadius: 6,
              color: integrationId ? "#fff" : V.textMuted,
              fontSize: 12,
              fontWeight: 700,
              cursor: integrationId ? "pointer" : "not-allowed",
              minWidth: 110,
            }}
          >
            {testing ? "Testing…" : "Test now"}
          </button>
        </div>

        {testResult ? (
          <div
            style={{
              padding: "10px 12px",
              background: testResult.ok ? V.greenBg : V.redBg,
              border: `1px solid ${testResult.ok ? V.greenBorder : V.redBorder}`,
              borderRadius: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: testResult.ok ? V.green : V.red }}>
              {testResult.ok ? "Connection successful" : "Connection failed"}
              {testResult.latencyMs !== undefined ? ` · ${testResult.latencyMs}ms` : ""}
            </div>
            {testResult.ok && testResult.sampleCount !== undefined ? (
              <div style={{ fontSize: 11, color: "#86efac", marginTop: 4 }}>
                {testResult.sampleCount} incident{testResult.sampleCount !== 1 ? "s" : ""} in first poll
              </div>
            ) : null}
            {!testResult.ok && testResult.error ? (
              <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>{testResult.error}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const secondaryBtnStyle: CSSProperties = {
  padding: "9px 12px",
  background: V.surfaceAlt,
  border: `1px solid ${V.border}`,
  borderRadius: 6,
  color: V.textSecondary,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

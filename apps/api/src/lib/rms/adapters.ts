import type { IncidentReport } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { isRmsMockMode } from "./claude-report.js";

export interface RmsPushResult {
  externalId: string;
  status: "pushed" | "pending_vendor";
}

export interface RmsAdapter {
  push(report: IncidentReport): Promise<RmsPushResult>;
}

function pendingVendor(report: IncidentReport, prefix: string): RmsPushResult {
  return { externalId: `${prefix}-pending-${report.reportId}`, status: "pending_vendor" };
}

/** Tyler New World — stub mapping; validate field names against vendor docs before go-live. */
export class TylerNewWorldAdapter implements RmsAdapter {
  constructor(
    private apiUrl: string,
    private apiKey: string,
  ) {}

  async push(report: IncidentReport): Promise<RmsPushResult> {
    if (isRmsMockMode() || !this.apiUrl || !this.apiKey) {
      return pendingVendor(report, "tyler");
    }
    const payload = {
      IncidentNumber: report.cadIncidentNumber ?? report.incidentId,
      IncidentDate: report.incidentDate,
      IncidentTime: report.incidentTime,
      IncidentType: report.incidentType,
      Location: report.incidentAddress,
      NarrativeText: report.narrative.officerNarrative,
      NIBRSCode: report.nibrsClassification?.offenseCode,
      Suspects: report.suspects,
      Victims: report.victims,
      Vehicles: report.vehicles,
    };

    const res = await fetch(`${this.apiUrl.replace(/\/$/, "")}/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Tyler API error ${res.status}`);
    const data = (await res.json()) as { IncidentId?: string; id?: string };
    return { externalId: String(data.IncidentId ?? data.id ?? ""), status: "pushed" };
  }
}

/** Mark43 — stub mapping; validate against vendor API before go-live. */
export class Mark43Adapter implements RmsAdapter {
  constructor(
    private apiUrl: string,
    private token: string,
  ) {}

  async push(report: IncidentReport): Promise<RmsPushResult> {
    if (isRmsMockMode() || !this.apiUrl || !this.token) {
      return pendingVendor(report, "mark43");
    }
    const payload = {
      reportingEventNumber: report.cadIncidentNumber,
      incidentDate: `${report.incidentDate}T${report.incidentTime}:00`,
      incidentType: report.incidentType,
      locationDescription: report.incidentAddress,
      narrative: report.narrative.officerNarrative,
      nibrsCode: report.nibrsClassification?.offenseCode,
    };

    const res = await fetch(`${this.apiUrl.replace(/\/$/, "")}/api/cad/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Mark43 API error ${res.status}`);
    const data = (await res.json()) as { id: string };
    return { externalId: String(data.id), status: "pushed" };
  }
}

export function getRmsAdapter(target: string, config: Record<string, string>): RmsAdapter {
  switch (target) {
    case "tyler-new-world":
      return new TylerNewWorldAdapter(config.apiUrl ?? "", config.apiKey ?? "");
    case "mark43":
      return new Mark43Adapter(config.apiUrl ?? "", config.token ?? "");
    default:
      throw new Error(`Unsupported RMS target: ${target}. Supported: tyler-new-world, mark43`);
  }
}

export function agencyEnvKey(agencyId: string): string {
  return agencyId.toUpperCase().replace(/-/g, "_");
}

type VendorSecret = {
  tylerApiKey: string;
  tylerApiUrl: string;
  mark43Token: string;
  mark43ApiUrl: string;
};

let vendorSecretCache: { value: VendorSecret; fetchedAt: number } | null = null;
const VENDOR_SECRET_TTL_MS = 300_000;

async function loadRmsVendorSecret(): Promise<VendorSecret> {
  const now = Date.now();
  if (vendorSecretCache && now - vendorSecretCache.fetchedAt < VENDOR_SECRET_TTL_MS) {
    return vendorSecretCache.value;
  }
  const arn = process.env.RMS_VENDOR_SECRET_ARN?.trim() ?? "";
  const [tylerApiKey, tylerApiUrl, mark43Token, mark43ApiUrl] = await Promise.all([
    resolvePlainOrSecretArn("", arn, { preferredField: "TYLER_API_KEY" }),
    resolvePlainOrSecretArn("", arn, { preferredField: "TYLER_API_URL" }),
    resolvePlainOrSecretArn(
      "",
      arn,
      { preferredField: "MARK43_API_KEY" },
    ).then(async (key) => {
      if (key) return key;
      return resolvePlainOrSecretArn("", arn, { preferredField: "MARK43_TOKEN" });
    }),
    resolvePlainOrSecretArn("", arn, { preferredField: "MARK43_API_URL" }),
  ]);
  const value: VendorSecret = {
    tylerApiKey: tylerApiKey.trim(),
    tylerApiUrl: tylerApiUrl.trim(),
    mark43Token: mark43Token.trim(),
    mark43ApiUrl: mark43ApiUrl.trim(),
  };
  vendorSecretCache = { value, fetchedAt: now };
  return value;
}

export async function resolveAgencyRmsConfig(agencyId: string): Promise<{
  target: string | undefined;
  config: Record<string, string>;
}> {
  const key = agencyEnvKey(agencyId);
  const vendor = await loadRmsVendorSecret();
  const target =
    process.env[`RMS_TARGET_${key}`]?.trim() || process.env.DEFAULT_RMS_TARGET?.trim() || undefined;
  const apiUrlFromEnv = process.env[`RMS_API_URL_${key}`]?.trim() ?? "";
  return {
    target,
    config: {
      apiUrl:
        apiUrlFromEnv ||
        (target === "mark43" ? vendor.mark43ApiUrl : vendor.tylerApiUrl),
      apiKey: vendor.tylerApiKey,
      token: vendor.mark43Token,
    },
  };
}

export function clearRmsVendorSecretCacheForTests(): void {
  vendorSecretCache = null;
}

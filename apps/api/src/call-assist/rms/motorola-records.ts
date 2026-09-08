import type { CallAssistCadCreatePayload } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { isRmsMockMode } from "../../lib/rms/claude-report.js";

export type MotorolaRecordsResult = {
  ok: boolean;
  blocked: boolean;
  reportNumber?: string;
  externalId?: string;
  reason: string;
};

function recordsBody(payload: CallAssistCadCreatePayload, sessionId: string): Record<string, unknown> {
  const intake = payload.intake;
  return {
    AgencyId: payload.agencyId,
    Source: "rapid-cortex-call-assist",
    SessionId: sessionId,
    CallType: payload.classification,
    Location: intake.locationText ?? payload.location.text ?? "",
    CallerName: intake.callerName ?? "",
    CallerPhone: intake.callbackNumber ?? "",
    Narrative: intake.summary ?? "",
    VehiclePlate: intake.vehiclePlate ?? "",
    RequiresHumanReview: true,
  };
}

/**
 * Motorola Records live filing. Fail-closed without credentials.
 * Demo/mock never calls the vendor.
 */
export async function submitMotorolaRecords(opts: {
  payload: CallAssistCadCreatePayload;
  sessionId: string;
  demo: boolean;
}): Promise<MotorolaRecordsResult> {
  if (opts.demo || isRmsMockMode() || env.callAssistConnectMock) {
    return {
      ok: true,
      blocked: false,
      reportNumber: `MO-MOCK-${opts.sessionId.slice(-8).toUpperCase()}`,
      externalId: `motorola-mock-${opts.sessionId}`,
      reason: "demo_mock_rms",
    };
  }
  const arn = process.env.RMS_VENDOR_SECRET_ARN?.trim() ?? "";
  const [apiUrl, apiKey] = await Promise.all([
    resolvePlainOrSecretArn(process.env.MOTOROLA_RECORDS_API_URL ?? "", arn, { preferredField: "MOTOROLA_RECORDS_API_URL" }),
    resolvePlainOrSecretArn(process.env.MOTOROLA_RECORDS_API_KEY ?? "", arn, { preferredField: "MOTOROLA_RECORDS_API_KEY" }),
  ]);
  if (!apiUrl?.trim() || !apiKey?.trim()) {
    return { ok: false, blocked: true, reason: "motorola_records_unconfigured" };
  }
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/v1/reports`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": apiKey.trim(),
      },
      body: JSON.stringify(recordsBody(opts.payload, opts.sessionId)),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, blocked: true, reason: `motorola_records_http_${res.status}` };
    }
    let reportNumber = "";
    let externalId = "";
    try {
      const json = text ? (JSON.parse(text) as { ReportNumber?: string; id?: string }) : {};
      reportNumber = json.ReportNumber?.trim() ?? "";
      externalId = json.id?.trim() ?? "";
    } catch {
      reportNumber = "";
    }
    return {
      ok: true,
      blocked: false,
      reportNumber: reportNumber || `MO-${Date.now()}`,
      externalId: externalId || reportNumber,
      reason: "motorola_records_filed",
    };
  } catch (err) {
    return {
      ok: false,
      blocked: true,
      reason: err instanceof Error ? err.message.slice(0, 180) : "motorola_records_http_failed",
    };
  }
}

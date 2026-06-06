import type {
  GenerateReportBody,
  ReportConfig,
  ReportResult,
  ReportType,
} from "rapid-cortex-shared";
import { isApiConfigured } from "@/lib/api";

const USE_AUTH_PROXY =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PROXY === "1";

const DIRECT_API_BASE =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "")
    : "";

function apiBase(): string {
  if (USE_AUTH_PROXY) {
    if (typeof window !== "undefined") return `${window.location.origin}/api/backend`;
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    return site ? `${site}/api/backend` : "http://127.0.0.1:3000/api/backend";
  }
  return DIRECT_API_BASE;
}

async function reportRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = apiBase();
  if (!base) throw new Error("API base URL not configured");
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: USE_AUTH_PROXY ? "include" : "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Request failed ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export function isReportsApiConfigured(): boolean {
  return isApiConfigured();
}

export async function generateReport(body: GenerateReportBody): Promise<ReportResult> {
  return reportRequest("/api/reports", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchReports(): Promise<ReportConfig[]> {
  const data = await reportRequest<{ items: ReportConfig[] }>("/api/reports");
  return data.items;
}

export async function fetchReport(reportId: string): Promise<ReportResult> {
  return reportRequest(`/api/reports/${encodeURIComponent(reportId)}`);
}

export async function exportReportJson(reportId: string): Promise<ReportResult> {
  return reportRequest(`/api/reports/${encodeURIComponent(reportId)}/export?format=json`);
}

export async function downloadReportCsv(reportId: string, filename?: string): Promise<void> {
  const base = apiBase();
  if (!base) throw new Error("API base URL not configured");
  const res = await fetch(
    `${base}/api/reports/${encodeURIComponent(reportId)}/export?format=csv`,
    { credentials: USE_AUTH_PROXY ? "include" : "same-origin" },
  );
  if (!res.ok) {
    const text = await res.text();
    let msg = `Export failed ${res.status}`;
    try {
      const body = JSON.parse(text) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `report-${reportId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function defaultReportName(type: ReportType): string {
  const d = new Date().toLocaleDateString();
  const labels: Record<ReportType, string> = {
    call_volume: "Call volume",
    response_times: "Response times",
    sla_compliance: "SLA compliance",
    dispatcher_performance: "Dispatcher performance",
    incident_summary: "Incident summary",
    qa_scores: "QA scores",
    translation_usage: "Translation usage",
    media_usage: "Media usage",
  };
  return `${labels[type]} — ${d}`;
}

export function dateInputToRange(start: string, end: string): { start: string; end: string } {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return {
    start: new Date(sy, sm - 1, sd).toISOString(),
    end: new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString(),
  };
}

export function lastNDaysRange(days: number): { start: string; end: string; startInput: string; endInput: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startInput = fmt(start);
  const endInput = fmt(end);
  return { ...dateInputToRange(startInput, endInput), startInput, endInput };
}

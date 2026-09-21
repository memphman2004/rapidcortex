import type {
  GenerateReportBody,
  ReportConfig,
  ReportResult,
  ReportType,
} from "rapid-cortex-shared";
import {
  calendarMonthLabelUtc,
  previousCalendarMonthRangeUtc,
  REPORT_TYPE_LABELS,
} from "rapid-cortex-shared";
import { isApiConfigured } from "@/lib/api";
import { resolveSameOriginBffBase, shouldUseBffCredentials } from "@/lib/same-origin-bff-base";

const DIRECT_API_BASE =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "")
    : "";

function apiBase(): string {
  return resolveSameOriginBffBase(DIRECT_API_BASE);
}

async function reportRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = apiBase();
  if (!base) throw new Error("API base URL not configured");
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: shouldUseBffCredentials() ? "include" : "same-origin",
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
    { credentials: shouldUseBffCredentials() ? "include" : "same-origin" },
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
  return `${REPORT_TYPE_LABELS[type]} — ${d}`;
}

/** Previous complete UTC calendar month (ISO range + date-input strings). */
export function previousCalendarMonthRange(): {
  start: string;
  end: string;
  startInput: string;
  endInput: string;
  label: string;
} {
  const range = previousCalendarMonthRangeUtc();
  return {
    ...range,
    startInput: range.start.slice(0, 10),
    endInput: range.end.slice(0, 10),
    label: calendarMonthLabelUtc(range.start),
  };
}

export function monthlySystemHealthReportName(monthLabel: string): string {
  return `System health — ${monthLabel}`;
}

export function dateInputToRange(start: string, end: string): { start: string; end: string } {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return {
    start: new Date(sy, sm - 1, sd).toISOString(),
    end: new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString(),
  };
}

/** Calendar-day bounds in UTC — used for monthly system health so the period is not shifted by the browser timezone. */
export function dateInputToUtcRange(start: string, end: string): { start: string; end: string } {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return {
    start: new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0)).toISOString(),
    end: new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999)).toISOString(),
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

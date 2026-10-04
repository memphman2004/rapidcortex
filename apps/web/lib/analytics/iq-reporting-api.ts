import type { IQDailyRecord, IQTimeRange, IQVertical } from "./iq-reporting-types";

const BASE = "/api/analytics/reporting";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  current?: IQDailyRecord[];
  prior?: IQDailyRecord[];
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T> & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatIsoDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Inclusive UTC [startDate, endDate] for the selected range. */
export function dateWindowForRange(
  range: IQTimeRange,
  now = new Date(),
): { startDate: string; endDate: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  switch (range) {
    case "today":
      return { startDate: formatIsoDateUtc(today), endDate: formatIsoDateUtc(today) };
    case "yesterday": {
      const y = addUtcDays(today, -1);
      return { startDate: formatIsoDateUtc(y), endDate: formatIsoDateUtc(y) };
    }
    case "7d":
      return { startDate: formatIsoDateUtc(addUtcDays(today, -6)), endDate: formatIsoDateUtc(today) };
    case "30d":
      return { startDate: formatIsoDateUtc(addUtcDays(today, -29)), endDate: formatIsoDateUtc(today) };
    case "month": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { startDate: formatIsoDateUtc(start), endDate: formatIsoDateUtc(today) };
    }
    case "quarter": {
      const q = Math.floor(today.getUTCMonth() / 3) * 3;
      const start = new Date(Date.UTC(today.getUTCFullYear(), q, 1));
      return { startDate: formatIsoDateUtc(start), endDate: formatIsoDateUtc(today) };
    }
    case "year": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      return { startDate: formatIsoDateUtc(start), endDate: formatIsoDateUtc(today) };
    }
  }
}

function priorWindow(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const priorEnd = addUtcDays(start, -1);
  const priorStart = addUtcDays(priorEnd, -(days - 1));
  return { startDate: formatIsoDateUtc(priorStart), endDate: formatIsoDateUtc(priorEnd) };
}

export async function fetchIQReporting(
  agencyId: string,
  vertical: IQVertical,
  range: IQTimeRange,
  opts?: { compare?: boolean },
): Promise<{ current: IQDailyRecord[]; prior?: IQDailyRecord[] }> {
  const { startDate, endDate } = dateWindowForRange(range);
  const qs = new URLSearchParams({ agencyId, vertical, startDate, endDate });
  const res = await fetch(`${BASE}?${qs.toString()}`, { credentials: "include" });
  const body = await parseJson<{ current?: IQDailyRecord[]; data?: { current?: IQDailyRecord[] } }>(res);
  const current = body.current ?? body.data?.current ?? [];

  if (!opts?.compare) {
    return { current };
  }

  const priorDates = priorWindow(startDate, endDate);
  const priorQs = new URLSearchParams({
    agencyId,
    vertical,
    startDate: priorDates.startDate,
    endDate: priorDates.endDate,
  });
  const priorRes = await fetch(`${BASE}?${priorQs.toString()}`, { credentials: "include" });
  const priorBody = await parseJson<{ current?: IQDailyRecord[]; data?: { current?: IQDailyRecord[] } }>(priorRes);
  return { current, prior: priorBody.current ?? priorBody.data?.current ?? [] };
}

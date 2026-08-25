/**
 * Rapid IQ ingest lookback. Default is calendar year 2026 so open RFPs posted
 * earlier in the year (e.g. county NG911 bids) still enter the signal queue.
 * Override with RAPID_IQ_INGEST_SINCE=YYYY-MM-DD.
 */
export const RAPID_IQ_DEFAULT_INGEST_SINCE = "2026-01-01";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function rapidIqIngestSinceDate(now = new Date()): string {
  const today = now.toISOString().slice(0, 10);
  const env = process.env.RAPID_IQ_INGEST_SINCE?.trim();
  if (env && ISO_DATE.test(env)) return env <= today ? env : today;
  return RAPID_IQ_DEFAULT_INGEST_SINCE <= today ? RAPID_IQ_DEFAULT_INGEST_SINCE : today;
}

/** SAM.gov `postedFrom` / `postedTo` use MM/DD/YYYY. */
export function toSamGovSlashDate(isoYmd: string): string {
  const [y, m, d] = isoYmd.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
}

export function rapidIqIngestSinceSlashDate(now = new Date()): string {
  return toSamGovSlashDate(rapidIqIngestSinceDate(now));
}

export function rapidIqIngestUntilSlashDate(now = new Date()): string {
  return toSamGovSlashDate(now.toISOString().slice(0, 10));
}

export function rapidIqIngestLookbackDays(now = new Date()): number {
  const since = Date.parse(`${rapidIqIngestSinceDate(now)}T00:00:00.000Z`);
  return Math.max(1, Math.ceil((now.getTime() - since) / 86_400_000));
}

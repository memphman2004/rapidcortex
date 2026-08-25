import { afterEach, describe, expect, it } from "vitest";
import {
  RAPID_IQ_DEFAULT_INGEST_SINCE,
  rapidIqIngestLookbackDays,
  rapidIqIngestSinceDate,
  rapidIqIngestSinceSlashDate,
  rapidIqIngestUntilSlashDate,
} from "../ingest-window.js";

describe("rapidIqIngestSinceDate", () => {
  afterEach(() => {
    delete process.env.RAPID_IQ_INGEST_SINCE;
  });

  it("defaults to 2026-01-01", () => {
    delete process.env.RAPID_IQ_INGEST_SINCE;
    expect(rapidIqIngestSinceDate(new Date("2026-08-16T12:00:00.000Z"))).toBe(
      RAPID_IQ_DEFAULT_INGEST_SINCE,
    );
  });

  it("honors RAPID_IQ_INGEST_SINCE", () => {
    process.env.RAPID_IQ_INGEST_SINCE = "2026-03-15";
    expect(rapidIqIngestSinceDate(new Date("2026-08-16T12:00:00.000Z"))).toBe("2026-03-15");
  });

  it("formats SAM.gov slash dates", () => {
    expect(rapidIqIngestSinceSlashDate(new Date("2026-08-16T12:00:00.000Z"))).toBe("01/01/2026");
  });

  it("formats postedTo as MM/DD/YYYY not YYYY/MM/DD", () => {
    expect(rapidIqIngestUntilSlashDate(new Date("2026-08-16T12:00:00.000Z"))).toBe("08/16/2026");
  });

  it("computes lookback days from 2026-01-01", () => {
    const days = rapidIqIngestLookbackDays(new Date("2026-08-16T12:00:00.000Z"));
    expect(days).toBeGreaterThanOrEqual(227);
    expect(days).toBeLessThanOrEqual(229);
  });
});

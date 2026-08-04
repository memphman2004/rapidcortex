import { z } from "zod";

/** Microsoft Bookings URLs stored under settings key `hiring_bookings`. */
export const HiringBookingsConfigSchema = z.object({
  phoneScreenUrl: z.string().max(1000).optional(),
  interviewUrl: z.string().max(1000).optional(),
  reviewerName: z.string().max(200).optional(),
});
export type HiringBookingsConfig = z.infer<typeof HiringBookingsConfigSchema>;

export const HIRING_BOOKINGS_SETTING_KEY = "hiring_bookings";

export function getBookingUrlForStatus(
  status: string,
  config: HiringBookingsConfig,
): string | undefined {
  if (status === "PHONE_SCREEN") {
    const u = config.phoneScreenUrl?.trim();
    return u || undefined;
  }
  if (status === "INTERVIEW") {
    const u = config.interviewUrl?.trim();
    return u || undefined;
  }
  return undefined;
}

/** Normalize empty strings; optionally require URL shape when set. */
export function normalizeHiringBookingsConfig(
  raw: HiringBookingsConfig,
): { ok: true; value: HiringBookingsConfig } | { ok: false; error: string } {
  const phoneScreenUrl = raw.phoneScreenUrl?.trim() || undefined;
  const interviewUrl = raw.interviewUrl?.trim() || undefined;
  const reviewerName = raw.reviewerName?.trim() || undefined;
  for (const [label, url] of [
    ["Phone Screen booking URL", phoneScreenUrl],
    ["Interview booking URL", interviewUrl],
  ] as const) {
    if (url && !/^https?:\/\//i.test(url)) {
      return { ok: false, error: `${label} must be an http(s) URL` };
    }
  }
  return { ok: true, value: { phoneScreenUrl, interviewUrl, reviewerName } };
}

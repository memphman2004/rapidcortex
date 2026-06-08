/**
 * When enabled, unset `NEXT_PUBLIC_ENABLE_*` gates read as on (see `runtime-flags.ts`).
 * **Exception:** `NEXT_PUBLIC_ENABLE_CAD_WRITEBACK` stays off unless explicitly set to `1`/`true`.
 *
 * Set `NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE=1` in `.env.local` or `.env.development`.
 * Set to `0` to force individual flags off even in development.
 */
export function isPilotTestModeEnabled(): boolean {
  if (typeof process === "undefined") return false;
  const raw = process.env.NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE?.trim();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return process.env.NEXT_PUBLIC_APP_ENV === "development";
}

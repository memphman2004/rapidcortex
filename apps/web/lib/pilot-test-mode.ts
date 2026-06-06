/**
 * When enabled, all `NEXT_PUBLIC_ENABLE_*` gates in `runtime-flags.ts` and Ring flags
 * read as on so agency admins and rcsuperadmin can exercise the full product surface in dev/pilot.
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

/**
 * Expands compact Lambda env from RC_RUNTIME_CONFIG_JSON (short keys) into process.env.
 * Keeps deployed environment under the 4 KB Lambda limit.
 */
import { LAMBDA_ENV_SHORT_TO_LONG } from "./lambdaEnvShortKeys";

let hydrated = false;

export function hydrateLambdaEnvFromJson(): void {
  if (hydrated) return;
  hydrated = true;

  const raw = process.env.RC_RUNTIME_CONFIG_JSON?.trim();
  if (!raw) return;

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error("RC_RUNTIME_CONFIG_JSON is not valid JSON");
  }

  for (const [shortKey, value] of Object.entries(parsed)) {
    if (value === undefined || value === null) continue;
    const longKey = LAMBDA_ENV_SHORT_TO_LONG[shortKey] ?? shortKey;
    if (process.env[longKey] === undefined || process.env[longKey] === "") {
      process.env[longKey] = String(value);
    }
  }
}

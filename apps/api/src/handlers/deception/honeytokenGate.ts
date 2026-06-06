import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { HONEYTOKENS, HONEYTOKEN_VALUES, type HoneytokenKey } from "./fakeData.js";
import { persistHoneytokenUse } from "./deceptionPersist.js";

function collectStrings(value: unknown, out: string[], depth: number): void {
  if (depth > 12) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const x of value) collectStrings(x, out, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out, depth + 1);
  }
}

function matchHoneytokenKey(text: string): HoneytokenKey | null {
  for (const key of Object.keys(HONEYTOKENS) as HoneytokenKey[]) {
    if (text.includes(HONEYTOKENS[key])) return key;
  }
  return null;
}

/**
 * Returns true if the request should receive HTTP 401 (after persisting a HONEYTOKEN_USED event).
 * When deception shield is disabled, always returns false.
 */
export async function detectHoneytokenBlock(event: APIGatewayProxyEventV2): Promise<boolean> {
  if (process.env.DECEPTION_SHIELD_ENABLED !== "true") return false;
  if (!process.env.DECEPTION_EVENTS_TABLE?.trim()) return false;

  const hdr =
    event.headers?.authorization ??
    event.headers?.Authorization ??
    event.headers?.["authorization"];
  if (hdr) {
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1]?.trim() ?? "";
    if (token) {
      for (const v of HONEYTOKEN_VALUES) {
        if (token.includes(v)) {
          const key = matchHoneytokenKey(token) ?? "CAD_API_KEY";
          await persistHoneytokenUse(event, key);
          return true;
        }
      }
    }
  }

  const apiKey =
    event.headers?.["x-api-key"] ??
    event.headers?.["X-Api-Key"] ??
    event.headers?.["x-api-key".toLowerCase()];
  if (apiKey) {
    for (const v of HONEYTOKEN_VALUES) {
      if (apiKey.includes(v)) {
        const key = matchHoneytokenKey(apiKey) ?? "RC_LITE_API_KEY";
        await persistHoneytokenUse(event, key);
        return true;
      }
    }
  }

  const qs = event.queryStringParameters ?? {};
  for (const val of Object.values(qs)) {
    if (!val) continue;
    for (const v of HONEYTOKEN_VALUES) {
      if (val.includes(v)) {
        const key = matchHoneytokenKey(val) ?? "CAD_API_KEY";
        await persistHoneytokenUse(event, key);
        return true;
      }
    }
  }

  if (event.body) {
    const strings: string[] = [];
    try {
      collectStrings(JSON.parse(event.body) as unknown, strings, 0);
    } catch {
      strings.push(event.body);
    }
    for (const s of strings) {
      for (const v of HONEYTOKEN_VALUES) {
        if (s.includes(v)) {
          const key = matchHoneytokenKey(s) ?? "CAD_API_KEY";
          await persistHoneytokenUse(event, key);
          return true;
        }
      }
    }
  }

  return false;
}

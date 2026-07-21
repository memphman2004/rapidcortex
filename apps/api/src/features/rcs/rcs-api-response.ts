import { jsonStatus } from "../../lib/response.js";

/** `{success,data}` envelope for RCS routes — mirrors `ok()` shape but explicit for this module. */
export function rcsJson<T>(data: T, statusCode = 200) {
  return jsonStatus({ success: true, data }, statusCode);
}

export function rcsError(message: string, statusCode = 400, extra?: Record<string, unknown>) {
  return jsonStatus({ success: false, error: message, ...extra }, statusCode);
}

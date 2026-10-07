import {
  badRequest,
  forbidden,
  jsonStatus,
  notFound,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";

export function mapLiveVideoError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "FORBIDDEN_ROLE" || msg === "TENANT_MISMATCH")
    return forbidden();
  if (msg === "SESSION_EXPIRED") return jsonStatus({ error: "session_expired" }, 410);
  if (msg === "SESSION_CLOSED") return jsonStatus({ error: "session_closed" }, 409);
  if (msg === "MISSING_PUBLIC_BASE_URL") {
    return badRequest(
      "Public base URL is not configured. Set LIVE_VIDEO_PUBLIC_BASE_URL or pass publicAppBaseUrl.",
    );
  }
  if (msg === "LIVE_VIDEO_DISABLED" || msg === "LIVE_VIDEO_SESSIONS_TABLE_NOT_CONFIGURED") {
    return serviceUnavailable("Live video is not enabled for this deployment");
  }
  if (msg === "KVS_NOT_CONFIGURED") {
    return serviceUnavailable(
      "Kinesis Video WebRTC is not configured (LIVE_VIDEO_KVS_TOKEN_ROLE_ARN)",
    );
  }
  return serverError();
}

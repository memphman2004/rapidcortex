import {
  watchSignalSchema,
  type WatchSignal,
} from "rapid-cortex-shared";
import { ALLOWED_WATCHES, type McpWatchConfig } from "../config.js";
import type { AuthPrincipal } from "../auth/authorize-write.js";
import { getWatchIngestApiKey } from "../secrets/watch-ingest-key.js";
import { auditLog, hashExternalKey } from "../security/audit.js";
import { checkAndIncrementRateLimit } from "../oauth/store.js";
import { postWatchIngest } from "../upstream/watch-ingest-client.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export async function executeSubmitWatchSignal(
  args: unknown,
  principal: AuthPrincipal,
  config: McpWatchConfig,
): Promise<ToolResult> {
  const started = Date.now();

  const rate = await checkAndIncrementRateLimit(
    config.oauthStateTableName,
    principal.subject,
    config.rateLimitPerHour,
  );
  if (!rate.allowed) {
    auditLog({
      event: "submit_watch_signal_rate_limited",
      subject: principal.subject,
      role: principal.role,
      status: 429,
    });
    return {
      isError: true,
      content: [{ type: "text", text: "Rate limit exceeded" }],
      structuredContent: { success: false, error: "RATE_LIMITED" },
    };
  }

  const parsed = watchSignalSchema.safeParse(args);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 12).map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    const summary = details.map((d) => `${d.path || "(root)"}: ${d.message}`).join("; ");
    auditLog({
      event: "submit_watch_signal_validation",
      subject: principal.subject,
      role: principal.role,
      errorCode: "VALIDATION_ERROR",
      // Redacted: paths/messages only — never log full Watch payload
      action: summary.slice(0, 400),
      durationMs: Date.now() - started,
    });
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `WatchSignal validation failed: ${summary}`,
        },
      ],
      structuredContent: {
        success: false,
        error: "VALIDATION_ERROR",
        details,
      },
    };
  }

  const signal: WatchSignal = parsed.data;
  if (!(ALLOWED_WATCHES as readonly string[]).includes(signal.watch)) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Watch category not enabled for MCP. Allowed: ${ALLOWED_WATCHES.join(", ")}`,
        },
      ],
      structuredContent: {
        success: false,
        error: "VALIDATION_ERROR",
        details: [{ path: "watch", message: "not in ALLOWED_WATCHES" }],
      },
    };
  }

  let apiKey: string;
  try {
    apiKey = await getWatchIngestApiKey(config.watchIngestApiKeySecretArn);
  } catch (err) {
    auditLog({
      event: "submit_watch_signal_secret_error",
      subject: principal.subject,
      errorCode: err instanceof Error ? err.message : "secret_error",
    });
    return {
      isError: true,
      content: [{ type: "text", text: "Ingest credentials unavailable" }],
      structuredContent: { success: false, error: "INGEST_NOT_CONFIGURED" },
    };
  }

  const result = await postWatchIngest(signal, {
    baseUrl: config.watchIngestBaseUrl,
    apiKey,
    maxAttempts: config.upstreamMaxAttempts,
  });

  auditLog({
    event: "submit_watch_signal",
    subject: principal.subject,
    role: principal.role,
    externalKeyHash: hashExternalKey(signal.external_key),
    action: result.success ? result.action : result.error,
    status: result.success ? 200 : result.status ?? 502,
    durationMs: Date.now() - started,
  });

  if (!result.success) {
    return {
      isError: true,
      content: [{ type: "text", text: result.message }],
      structuredContent: {
        success: false,
        error: result.error,
        status: result.status,
        details: result.details,
        external_key: signal.external_key,
      },
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Watch signal ${result.action}: ${result.signal_id} (${result.external_key})`,
      },
    ],
    structuredContent: {
      success: true,
      action: result.action,
      signal_id: result.signal_id,
      external_key: result.external_key,
      lifecycle_event_created: result.lifecycle_event_created,
      possible_duplicate: result.possible_duplicate,
      possible_duplicate_of: result.possible_duplicate_of,
      priority_score: result.priority_score,
      priority_label: result.priority_label,
    },
  };
}

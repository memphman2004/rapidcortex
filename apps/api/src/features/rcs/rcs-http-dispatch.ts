/**
 * Map HTTP method + path to an RCS handler name and pathParameters.
 * Used by the `ANY /api/rcs/{proxy+}` catch-all so stack-2 SAM OpenAPI
 * updates cannot leave RCS as API Gateway `{ message: "Not Found" }`.
 */

export type RcsHttpTarget = {
  handler:
    | "list"
    | "start"
    | "state"
    | "close"
    | "audioAlert"
    | "acknowledge"
    | "unitPosition"
    | "summary"
    | "handoff"
    | "floorHealth"
    | "escalationRules";
  pathParameters: Record<string, string>;
};

const CALL_ID = "([^/]+)";

const ROUTES: Array<{ method: string; pattern: RegExp; handler: RcsHttpTarget["handler"] }> = [
  { method: "GET", pattern: /^\/api\/rcs\/calls\/?$/, handler: "list" },
  { method: "POST", pattern: /^\/api\/rcs\/calls\/?$/, handler: "start" },
  { method: "PATCH", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/state/?$`), handler: "state" },
  { method: "POST", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/close/?$`), handler: "close" },
  { method: "POST", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/audio-alert/?$`), handler: "audioAlert" },
  { method: "POST", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/acknowledge/?$`), handler: "acknowledge" },
  { method: "POST", pattern: /^\/api\/rcs\/units\/position\/?$/, handler: "unitPosition" },
  { method: "GET", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/summary/?$`), handler: "summary" },
  { method: "POST", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/summary/?$`), handler: "summary" },
  { method: "POST", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/handoff/accept/?$`), handler: "handoff" },
  { method: "POST", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/handoff/?$`), handler: "handoff" },
  { method: "DELETE", pattern: new RegExp(`^/api/rcs/calls/${CALL_ID}/handoff/?$`), handler: "handoff" },
  { method: "GET", pattern: /^\/api\/rcs\/floor-health\/?$/, handler: "floorHealth" },
  { method: "GET", pattern: /^\/api\/rcs\/escalation-rules\/?$/, handler: "escalationRules" },
  { method: "PUT", pattern: /^\/api\/rcs\/escalation-rules\/?$/, handler: "escalationRules" },
];

export function matchRcsHttpRoute(method: string, rawPath: string): RcsHttpTarget | null {
  const verb = method.trim().toUpperCase();
  const path = (rawPath.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;

  for (const route of ROUTES) {
    if (route.method !== verb) continue;
    const match = normalized.match(route.pattern);
    if (!match) continue;
    const pathParameters: Record<string, string> = {};
    if (match[1]) pathParameters.callId = match[1];
    return { handler: route.handler, pathParameters };
  }
  return null;
}

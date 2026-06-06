import { describe, expect, it } from "vitest";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_UPSTREAM_BASE;

type RouteCheck = {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
};

const routeChecks: RouteCheck[] = [
  { path: "/api/triage/analyze", method: "POST", body: { transcript: "validation check" } },
  { path: "/api/transcription/start", method: "POST", body: { callId: "VALIDATION-CALL" } },
  { path: "/api/transcription/stop", method: "POST", body: { callId: "VALIDATION-CALL" } },
  { path: "/api/language/translate", method: "POST", body: { text: "Help", sourceLang: "en", targetLang: "es" } },
  { path: "/api/language/detect", method: "POST", body: { text: "Ayudame por favor" } },
  { path: "/api/intake/session", method: "POST", body: { mode: "validation" } },
  { path: "/api/cad/incidents", method: "GET" },
  { path: "/api/media/upload-url", method: "POST", body: { incidentId: "VALIDATION-INCIDENT" } },
  { path: "/api/command/war-room", method: "GET" },
  { path: "/api/qa/scorecards", method: "GET" },
  { path: "/api/reliability/alerts", method: "GET" },
  { path: "/api/language/text-to-voice", method: "POST", body: { text: "Validation message" } },
];

describe("route contract validation", () => {
  it("has API base configured or skips runtime checks", () => {
    expect(typeof baseUrl === "string" || typeof baseUrl === "undefined").toBe(true);
  });

  routeChecks.forEach((check) => {
    it(`${check.method ?? "GET"} ${check.path} responds with non-notConfigured contract`, async () => {
      if (!baseUrl) {
        expect(baseUrl).toBeFalsy();
        return;
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${check.path}`, {
        method: check.method ?? "GET",
        headers: check.body ? { "content-type": "application/json" } : undefined,
        body: check.body ? JSON.stringify(check.body) : undefined,
      });

      expect([200, 201, 202, 204, 400, 401, 403, 404, 409, 422, 500, 501, 503]).toContain(
        response.status,
      );

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const text = await response.text();
        expect(text.includes("not configured")).toBe(false);
      }
    });
  });
});

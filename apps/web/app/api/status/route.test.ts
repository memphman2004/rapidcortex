import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/status/route";

const SENSITIVE_KEY_PATTERN =
  /(secret|token|password|apikey|api[_-]?key|authorization|agencyid|callerphone|transcript)/i;

function collectSensitiveKeys(value: unknown, currentPath = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectSensitiveKeys(entry, `${currentPath}[${index}]`),
    );
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
    const path = currentPath ? `${currentPath}.${key}` : key;
    const ownMatch = SENSITIVE_KEY_PATTERN.test(key) ? [path] : [];
    return [...ownMatch, ...collectSensitiveKeys(nestedValue, path)];
  });
}

describe("GET /api/status", () => {
  it("returns public status payload with ok true", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      ok: boolean;
      overallStatus: string;
      incidentHistory: unknown[];
    };

    expect(body.ok).toBe(true);
    expect(body.overallStatus).toBe("operational");
    expect(Array.isArray(body.incidentHistory)).toBe(true);
  });

  it("does not expose sensitive keys in payload", async () => {
    const response = await GET();
    const body = await response.json();
    const sensitivePaths = collectSensitiveKeys(body);
    expect(sensitivePaths).toEqual([]);
  });
});

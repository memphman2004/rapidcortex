import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/public/status/route";

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

describe("GET /api/public/status", () => {
  it("returns safe public status JSON", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.overallStatus).toBe("string");
    expect(Array.isArray(body.components)).toBe(true);
    expect(collectSensitiveKeys(body)).toEqual([]);
  });
});

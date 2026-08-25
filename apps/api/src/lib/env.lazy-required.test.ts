import { afterEach, describe, expect, it } from "vitest";
import { env } from "./env.js";

const PSAP_KEYS = [
  "INCIDENTS_TABLE",
  "TRANSCRIPTS_TABLE",
  "ANALYSES_TABLE",
  "AGENCIES_TABLE",
  "INVITES_TABLE",
  "ASSETS_BUCKET",
] as const;

describe("env lazy PSAP required vars", () => {
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of PSAP_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("imports and reads Rapid IQ flags without PSAP table env vars", () => {
    for (const key of PSAP_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    expect(env.region).toBeTruthy();
    expect(typeof env.enableRapidIqPipeline).toBe("boolean");
    expect(typeof env.rapidIqPipelineSignalsTable).toBe("string");
  });

  it("still throws when a PSAP handler reads incidentsTable", () => {
    saved.INCIDENTS_TABLE = process.env.INCIDENTS_TABLE;
    delete process.env.INCIDENTS_TABLE;
    expect(() => env.incidentsTable).toThrow(/INCIDENTS_TABLE/);
  });
});

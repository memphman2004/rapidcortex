import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAD_WRITEBACK_ENV_DISABLED_ERROR,
  cadWritebackEnvBlockedResponse,
  isCadWritebackEnvEnabled,
} from "./cad-writeback-gate";

describe("isCadWritebackEnvEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults off when unset", () => {
    vi.unstubAllEnvs();
    expect(isCadWritebackEnvEnabled()).toBe(false);
  });

  it("defaults off for empty string", () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "");
    expect(isCadWritebackEnvEnabled()).toBe(false);
  });

  it('enables for explicit "true"', () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "true");
    expect(isCadWritebackEnvEnabled()).toBe(true);
  });

  it('enables for explicit "1"', () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "1");
    expect(isCadWritebackEnvEnabled()).toBe(true);
  });

  it('enables for uppercase "TRUE" (case-insensitive)', () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "TRUE");
    expect(isCadWritebackEnvEnabled()).toBe(true);
  });

  it('disables for explicit "false" and "0"', () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "false");
    expect(isCadWritebackEnvEnabled()).toBe(false);
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "0");
    expect(isCadWritebackEnvEnabled()).toBe(false);
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "FALSE");
    expect(isCadWritebackEnvEnabled()).toBe(false);
  });
});

describe("cadWritebackEnvBlockedResponse", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns API-matching 400 when env gate is off", async () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "false");
    const res = cadWritebackEnvBlockedResponse();
    expect(res).not.toBeNull();
    expect(res?.status).toBe(400);
    expect(await res?.json()).toEqual({ error: CAD_WRITEBACK_ENV_DISABLED_ERROR });
  });

  it("returns null when env gate is on", () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "true");
    expect(cadWritebackEnvBlockedResponse()).toBeNull();
  });
});

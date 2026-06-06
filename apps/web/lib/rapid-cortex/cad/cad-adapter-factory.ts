import type { CadAdapter } from "@/lib/rapid-cortex/cad/cad-adapter";
import { CentralsquareCadAdapter } from "@/lib/rapid-cortex/cad/adapters/centralsquare-adapter";
import { GenericCadAdapter } from "@/lib/rapid-cortex/cad/adapters/generic-cad-adapter";
import { HexagonCadAdapter } from "@/lib/rapid-cortex/cad/adapters/hexagon-adapter";
import { MockCadAdapter } from "@/lib/rapid-cortex/cad/adapters/mock-cad-adapter";
import { MotorolaCadAdapter } from "@/lib/rapid-cortex/cad/adapters/motorola-adapter";
import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";
import { TylerCadAdapter } from "@/lib/rapid-cortex/cad/adapters/tyler-adapter";
import type { CadConnectionConfig, CadVendor } from "@/lib/rapid-cortex/cad/types";

function asNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeVendor(raw: string | undefined): CadVendor {
  const vendor = (raw ?? "mock").trim().toLowerCase();
  if (
    vendor === "motorola" ||
    vendor === "centralsquare" ||
    vendor === "tyler" ||
    vendor === "hexagon" ||
    vendor === "generic" ||
    vendor === "mock"
  ) {
    return vendor;
  }
  return "mock";
}

export function readCadConnectionConfig(agencyId: string): CadConnectionConfig {
  const vendor = normalizeVendor(process.env.CAD_VENDOR);
  const rawMode = (process.env.RAPID_CORTEX_CAD_MODE ?? "mock").trim().toLowerCase();
  const normalizedMode = rawMode === "mock" ? "assisted_writeback" : rawMode;
  const mode =
    normalizedMode === "disabled" ||
    normalizedMode === "read_only" ||
    normalizedMode === "assisted_writeback"
      ? normalizedMode
      : "assisted_writeback";
  return {
    agencyId,
    vendor,
    mode,
    apiBaseUrl: process.env.CAD_API_BASE_URL?.trim() || undefined,
    clientId: process.env.CAD_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.CAD_CLIENT_SECRET?.trim() || undefined,
    apiKey: process.env.CAD_API_KEY?.trim() || undefined,
    timeoutMs: asNumber(process.env.CAD_TIMEOUT_MS, 10000),
    writebackEnabled: asBool(process.env.CAD_WRITEBACK_ENABLED, false),
    mockFailureRate: Math.max(0, Math.min(1, asNumber(process.env.CAD_MOCK_FAILURE_RATE, 0))),
  };
}

export class CadAdapterFactory {
  create(config: CadConnectionConfig): CadAdapter {
    // TODO(prod) — Section 4.1: assert production task definitions set `CAD_WRITEBACK_ENABLED=false` and
    // `CAD_WRITEBACK_REQUIRES_SUPERVISOR_APPROVAL` / manual-mode defaults via env; optionally wrap adapters so
    // `writebackEnabled===false` always routes to DisabledWrite stubs even if CAD_VENDOR≠mock.

    if (config.mode === "disabled") {
      return new NotConfiguredCadAdapter(config.vendor);
    }

    switch (config.vendor) {
      case "mock":
        return new MockCadAdapter(config.mockFailureRate);
      case "motorola":
        return new MotorolaCadAdapter();
      case "centralsquare":
        return new CentralsquareCadAdapter();
      case "tyler":
        return new TylerCadAdapter();
      case "hexagon":
        return new HexagonCadAdapter();
      case "generic":
        return new GenericCadAdapter();
      default:
        return new NotConfiguredCadAdapter("generic");
    }
  }
}

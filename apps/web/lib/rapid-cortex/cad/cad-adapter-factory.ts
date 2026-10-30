import type { CadAdapter } from "@/lib/rapid-cortex/cad/cad-adapter";
import { CaliberCadAdapter } from "@/lib/rapid-cortex/cad/adapters/caliber-adapter";
import { CentralsquareCadAdapter } from "@/lib/rapid-cortex/cad/adapters/centralsquare-adapter";
import { CodyCadAdapter } from "@/lib/rapid-cortex/cad/adapters/cody-adapter";
import { EforceCadAdapter } from "@/lib/rapid-cortex/cad/adapters/eforce-adapter";
import { GenericCadAdapter } from "@/lib/rapid-cortex/cad/adapters/generic-cad-adapter";
import { HexagonCadAdapter } from "@/lib/rapid-cortex/cad/adapters/hexagon-adapter";
import { KabatOneCadAdapter } from "@/lib/rapid-cortex/cad/adapters/kabat-one-adapter";
import { Mark43CadAdapter } from "@/lib/rapid-cortex/cad/adapters/mark43-adapter";
import { MockCadAdapter } from "@/lib/rapid-cortex/cad/adapters/mock-cad-adapter";
import { MotorolaCadAdapter } from "@/lib/rapid-cortex/cad/adapters/motorola-adapter";
import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";
import { OraclePsdcCadAdapter } from "@/lib/rapid-cortex/cad/adapters/oracle-psdc-adapter";
import { ProPhoenixCadAdapter } from "@/lib/rapid-cortex/cad/adapters/prophoenix-adapter";
import { RapidDeployCadAdapter } from "@/lib/rapid-cortex/cad/adapters/rapiddeploy-adapter";
import { SpillmanCadAdapter } from "@/lib/rapid-cortex/cad/adapters/spillman-adapter";
import { SunridgeRimsCadAdapter } from "@/lib/rapid-cortex/cad/adapters/sunridge-rims-adapter";
import { TylerCadAdapter } from "@/lib/rapid-cortex/cad/adapters/tyler-adapter";
import { VersatermCadAdapter } from "@/lib/rapid-cortex/cad/adapters/versaterm-adapter";
import { ZetronCadAdapter } from "@/lib/rapid-cortex/cad/adapters/zetron-adapter";
import { isCadWritebackEnvEnabled } from "@/lib/rapid-cortex/cad/cad-writeback-gate";
import type { CadConnectionConfig, CadVendor } from "@/lib/rapid-cortex/cad/types";

function asNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const PILOT_VENDORS = new Set<CadVendor>([
  "motorola",
  "centralsquare",
  "tyler",
  "hexagon",
  "spillman",
  "mark43",
  "caliber",
  "versaterm",
  "rapiddeploy",
  "zetron",
  "eforce",
  "cody",
  "sunridge_rims",
  "kabat_one",
  "oracle_psdc",
  "prophoenix",
  "generic",
  "mock",
]);

function normalizeVendor(raw: string | undefined): CadVendor {
  const vendor = (raw ?? "mock").trim().toLowerCase().replace(/-/g, "_");
  // Aliases for connector / marketing names → pilot CadVendor ids
  if (vendor === "tritech" || vendor === "central_square" || vendor === "centralsquare") {
    return "centralsquare";
  }
  if (vendor === "motorola_premierone" || vendor === "motorola_premier_one") return "motorola";
  if (vendor === "tyler_new_world") return "tyler";
  if (vendor === "hexagon_intergraph") return "hexagon";
  if (vendor === "generic_rest") return "generic";
  if (vendor === "pro_phoenix" || vendor === "phoenix") return "prophoenix";
  if (PILOT_VENDORS.has(vendor as CadVendor)) {
    return vendor as CadVendor;
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
    writebackEnabled: isCadWritebackEnvEnabled(),
    mockFailureRate: Math.max(0, Math.min(1, asNumber(process.env.CAD_MOCK_FAILURE_RATE, 0))),
  };
}

export class CadAdapterFactory {
  create(config: CadConnectionConfig): CadAdapter {
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
      case "spillman":
        return new SpillmanCadAdapter();
      case "mark43":
        return new Mark43CadAdapter();
      case "caliber":
        return new CaliberCadAdapter();
      case "versaterm":
        return new VersatermCadAdapter();
      case "rapiddeploy":
        return new RapidDeployCadAdapter();
      case "zetron":
        return new ZetronCadAdapter();
      case "eforce":
        return new EforceCadAdapter();
      case "cody":
        return new CodyCadAdapter();
      case "sunridge_rims":
        return new SunridgeRimsCadAdapter();
      case "kabat_one":
        return new KabatOneCadAdapter();
      case "oracle_psdc":
        return new OraclePsdcCadAdapter();
      case "prophoenix":
        return new ProPhoenixCadAdapter();
      case "generic":
        return new GenericCadAdapter();
      default:
        return new NotConfiguredCadAdapter("generic");
    }
  }
}

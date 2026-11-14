import type { AgencyConfig, CadWritebackAgencyConfig } from "rapid-cortex-shared";

const DEFAULT_GATES: CadWritebackAgencyConfig = {
  cadAddendumSigned: false,
  cadAutomatedWritebackEnabled: false,
};

export function resolveCadWritebackGates(
  config: AgencyConfig | null | undefined,
): CadWritebackAgencyConfig {
  const raw = config?.cadWriteback;
  return {
    cadAddendumSigned: raw?.cadAddendumSigned === true,
    cadAutomatedWritebackEnabled: raw?.cadAutomatedWritebackEnabled === true,
  };
}

/** Human-assisted submit / approve→vendor requires a signed addendum. */
export function assertHumanWritebackAllowed(
  config: AgencyConfig | null | undefined,
): { ok: true } | { ok: false; error: string } {
  const gates = resolveCadWritebackGates(config);
  if (!gates.cadAddendumSigned) {
    return {
      ok: false,
      error: "CAD write-back requires a signed addendum (cadAddendumSigned) on the agency config",
    };
  }
  return { ok: true };
}

/**
 * Automated delivery (skip supervisor approval / direct vendor POST) requires
 * both the signed addendum and the separate automated flag.
 */
export function assertAutomatedWritebackAllowed(
  config: AgencyConfig | null | undefined,
): { ok: true } | { ok: false; error: string } {
  const gates = resolveCadWritebackGates(config ?? undefined);
  if (!gates.cadAddendumSigned) {
    return {
      ok: false,
      error: "CAD automated write-back requires a signed addendum (cadAddendumSigned)",
    };
  }
  if (!gates.cadAutomatedWritebackEnabled) {
    return {
      ok: false,
      error:
        "CAD automated write-back is not enabled for this agency (cadAutomatedWritebackEnabled)",
    };
  }
  return { ok: true };
}

export { DEFAULT_GATES as CAD_WRITEBACK_GATES_DEFAULT };

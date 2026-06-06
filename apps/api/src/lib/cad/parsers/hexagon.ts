import type { CadIntegrationSetupContext } from "../types.js";
import type { CadParser } from "../types.js";
import { motorolaPremierOneCadParser } from "./motorolaPremierOne.js";

/** Hexagon / Intergraph-style JSON: delegate to flexible Motorola-like keys when possible. */
export const hexagonCadParser: CadParser = {
  ...motorolaPremierOneCadParser,
  vendor: "hexagon",
  validate(rawPayload: unknown): boolean {
    return motorolaPremierOneCadParser.validate(rawPayload);
  },
  parse(rawPayload: unknown) {
    const base = motorolaPremierOneCadParser.parse(rawPayload);
    return { ...base, rawPayload };
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    const tp = integration.tokenPreview?.trim() || "****";
    return [
      `Hexagon / Intergraph CAD — “${integration.name}” (${integration.id}):`,
      "",
      `POST ${u}`,
      `X-RC-Token: …${tp}`,
      "Optional integrity: X-RC-Signature: sha256=<hex> (HMAC-SHA256 of raw body, key=plaintext token).",
      "",
      "Send JSON or XML incident updates; Rapid Cortex accepts Motorola-style fields",
      "(IncidentNumber, NatureCode, Location, Priority, Units) or vendor-specific keys.",
    ].join("\n");
  },
};

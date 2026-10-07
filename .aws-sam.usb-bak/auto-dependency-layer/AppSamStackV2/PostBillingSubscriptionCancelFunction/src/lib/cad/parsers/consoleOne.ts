import type { CadIntegrationSetupContext } from "../types.js";
import type { CadParser } from "../types.js";
import { centralSquareCadParser } from "./centralSquare.js";

/** Console One style payloads: treat similar to CentralSquare JSON incident envelope. */
export const consoleOneCadParser: CadParser = {
  ...centralSquareCadParser,
  vendor: "console_one",
  validate(rawPayload: unknown): boolean {
    return centralSquareCadParser.validate(rawPayload);
  },
  parse(rawPayload: unknown) {
    const base = centralSquareCadParser.parse(rawPayload);
    return { ...base, rawPayload };
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    const tp = integration.tokenPreview?.trim() || "****";
    return [
      `Console One — “${integration.name}” (${integration.id}):`,
      "",
      `POST ${u}`,
      `X-RC-Token: …${tp}`,
      "Optional integrity: X-RC-Signature: sha256=<hex> (HMAC-SHA256 of raw body, key=plaintext token).",
      "",
      "Use JSON incident payloads with incident_id, nature, address, priority, and assigned_units when available.",
    ].join("\n");
  },
};

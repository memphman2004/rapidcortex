import type { CadVendor } from "rapid-cortex-shared";
import type { CadParser } from "../types.js";
import { centralSquareCadParser } from "./centralSquare.js";
import { consoleOneCadParser } from "./consoleOne.js";
import { genericWebhookCadParser } from "./genericWebhook.js";
import { hexagonCadParser } from "./hexagon.js";
import { motorolaPremierOneCadParser } from "./motorolaPremierOne.js";
import { tylerNewWorldCadParser } from "./tylerNewWorld.js";

const parsers: Record<CadVendor, CadParser> = {
  motorola_premier_one: motorolaPremierOneCadParser,
  tyler_new_world: tylerNewWorldCadParser,
  central_square: centralSquareCadParser,
  hexagon: hexagonCadParser,
  console_one: consoleOneCadParser,
  generic_webhook: genericWebhookCadParser,
};

export function getCadParser(vendor: CadVendor): CadParser {
  return parsers[vendor];
}

/** Alias for integration guides that refer to `getParser(vendor)`. */
export function getParser(vendor: string): CadParser {
  return getCadParser(vendor as CadVendor);
}

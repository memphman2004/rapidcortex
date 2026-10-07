import type { CadVendor } from "rapid-cortex-shared";
import { centralSquareWriteAdapter } from "./centralSquareWriteAdapter.js";
import { genericWriteAdapter } from "./genericWriteAdapter.js";
import { hexagonWriteAdapter } from "./hexagonWriteAdapter.js";
import { motorolaWriteAdapter } from "./motorolaWriteAdapter.js";
import { tylerWriteAdapter } from "./tylerWriteAdapter.js";
import type { CadWriteAdapter } from "./writeTypes.js";

const adapters: Record<CadVendor, CadWriteAdapter> = {
  motorola_premier_one: motorolaWriteAdapter,
  tyler_new_world: tylerWriteAdapter,
  central_square: centralSquareWriteAdapter,
  hexagon: hexagonWriteAdapter,
  console_one: genericWriteAdapter,
  generic_webhook: genericWriteAdapter,
};

export function getCadWriteAdapter(vendor: string): CadWriteAdapter {
  const a = adapters[vendor as CadVendor];
  if (!a) return genericWriteAdapter;
  return a;
}

export type { CadWriteAdapter } from "./writeTypes.js";

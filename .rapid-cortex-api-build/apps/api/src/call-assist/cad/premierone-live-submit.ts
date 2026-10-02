import type { CallAssistCadCreatePayload } from "rapid-cortex-shared";
import { submitCadVendorCreate, type CadVendorLiveResult } from "./vendor-live-submit.js";

/** @deprecated Use submitCadVendorCreate("motorola-premierone", payload) */
export type PremierOneLiveResult = CadVendorLiveResult;

export async function submitPremierOneCreate(payload: CallAssistCadCreatePayload): Promise<PremierOneLiveResult> {
  return submitCadVendorCreate("motorola-premierone", payload);
}

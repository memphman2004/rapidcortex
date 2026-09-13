"use client";

import { isConnectWyzeEnabled, isRapidVisionWyzeEnabled } from "@/lib/runtime-flags";

/** Wyze Connect — default ON when unset; hide tab when explicitly disabled. */
export function isWyzeEnabled(): boolean {
  return isConnectWyzeEnabled();
}

export { isRapidVisionWyzeEnabled };

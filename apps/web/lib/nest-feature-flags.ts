"use client";

import { isConnectNestEnabled } from "@/lib/runtime-flags";

/** Nest Connect — default ON when unset; hide tab when explicitly disabled. */
export function isNestEnabled(): boolean {
  return isConnectNestEnabled();
}

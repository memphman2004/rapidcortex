"use client";

/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

import { RING_INTEGRATION_ENABLED } from "@/lib/feature-flags";
import { isPilotTestModeEnabled } from "@/lib/pilot-test-mode";

const RING_FLAG_VALUES = {
  NEXT_PUBLIC_ENABLE_CONNECT_RING: process.env.NEXT_PUBLIC_ENABLE_CONNECT_RING,
  NEXT_PUBLIC_ENABLE_CONNECT_RING_AVAILABLE_CAMERAS: process.env.NEXT_PUBLIC_ENABLE_CONNECT_RING_AVAILABLE_CAMERAS,
  NEXT_PUBLIC_ENABLE_CONNECT_RING_EMERGENCY_REQUESTS: process.env.NEXT_PUBLIC_ENABLE_CONNECT_RING_EMERGENCY_REQUESTS,
};

function ringFlag(name: string): boolean {
  const raw = (RING_FLAG_VALUES as Record<string, string | undefined>)[name];
  const value = raw?.trim().toLowerCase();
  if (value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  if (isPilotTestModeEnabled()) return true;
  return true;
}

export function isRingEnabled(): boolean {
  // RING_DISABLED — integration suspended pending Ring developer program approval
  return RING_INTEGRATION_ENABLED && ringFlag("NEXT_PUBLIC_ENABLE_CONNECT_RING");
}

export function isRingAvailableCamerasEnabled(): boolean {
  return RING_INTEGRATION_ENABLED && ringFlag("NEXT_PUBLIC_ENABLE_CONNECT_RING_AVAILABLE_CAMERAS");
}

export function isRingEmergencyRequestsEnabled(): boolean {
  return RING_INTEGRATION_ENABLED && ringFlag("NEXT_PUBLIC_ENABLE_CONNECT_RING_EMERGENCY_REQUESTS");
}

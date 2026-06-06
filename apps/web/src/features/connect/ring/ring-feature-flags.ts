"use client";

import { isPilotTestModeEnabled } from "@/lib/pilot-test-mode";

const RING_FLAG_VALUES = {
  NEXT_PUBLIC_ENABLE_CONNECT_RING: process.env.NEXT_PUBLIC_ENABLE_CONNECT_RING,
  NEXT_PUBLIC_ENABLE_CONNECT_RING_AVAILABLE_CAMERAS: process.env.NEXT_PUBLIC_ENABLE_CONNECT_RING_AVAILABLE_CAMERAS,
  NEXT_PUBLIC_ENABLE_CONNECT_RING_EMERGENCY_REQUESTS: process.env.NEXT_PUBLIC_ENABLE_CONNECT_RING_EMERGENCY_REQUESTS,
};

function ringFlag(name: string): boolean {
  if (isPilotTestModeEnabled()) return true;
  const value = (RING_FLAG_VALUES as Record<string, string | undefined>)[name]?.trim().toLowerCase();
  return value === "1" || value === "true";
}

export function isRingEnabled(): boolean {
  return ringFlag("NEXT_PUBLIC_ENABLE_CONNECT_RING");
}

export function isRingAvailableCamerasEnabled(): boolean {
  return ringFlag("NEXT_PUBLIC_ENABLE_CONNECT_RING_AVAILABLE_CAMERAS");
}

export function isRingEmergencyRequestsEnabled(): boolean {
  return ringFlag("NEXT_PUBLIC_ENABLE_CONNECT_RING_EMERGENCY_REQUESTS");
}

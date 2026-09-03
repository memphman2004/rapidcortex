"use client";

import { Bus, Ship, Train } from "lucide-react";
import type { TransitVehicleMode } from "rapid-cortex-shared";
import { T } from "./transit-theme";

export function TransitVehicleModeIcon({
  mode,
  size = 14,
}: {
  mode: TransitVehicleMode;
  size?: number;
}) {
  const color = T.blue;
  if (mode === "ferry") return <Ship size={size} color={color} />;
  if (mode === "light_rail" || mode === "commuter_rail") return <Train size={size} color={color} />;
  return <Bus size={size} color={color} />;
}

import { CalculateRouteCommand } from "@aws-sdk/client-location";
import type { AlsRouteResult } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { getLocationClient, LocationNotConfiguredError } from "./client.js";

export async function calculateRoute(
  origin: [number, number],
  destination: [number, number],
): Promise<AlsRouteResult> {
  if (!env.alsRouteCalculatorName) {
    throw new LocationNotConfiguredError("route calculator");
  }
  const resp = await getLocationClient().send(
    new CalculateRouteCommand({
      CalculatorName: env.alsRouteCalculatorName,
      DeparturePosition: origin,
      DestinationPosition: destination,
      TravelMode: "Car",
      DistanceUnit: "Miles",
      IncludeLegGeometry: true,
    }),
  );
  return {
    distanceMiles: resp.Summary?.Distance ?? 0,
    durationMinutes: Math.ceil((resp.Summary?.DurationSeconds ?? 0) / 60),
    geometry:
      resp.Legs?.flatMap((leg) => (leg.Geometry?.LineString ?? []) as [number, number][]) ?? [],
    provider: "amazon-location",
  };
}

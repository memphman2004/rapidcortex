import type { DemoLocation } from "../types";

/**
 * Every scenario address comes from this list. None of these streets exist
 * as a real 911 location in the product's operational data.
 */
export const MAPLEWOOD_LOCATIONS: readonly DemoLocation[] = [
  { id: "loc-ridgemont-blvd", label: "2847 Ridgemont Blvd, Ridgemont", kind: "address" },
  { id: "loc-willow-creek", label: "118 Willow Creek Court, Maplewood County", kind: "address" },
  { id: "loc-clearfield-orchard", label: "Clearfield Rd & Orchard Lane, Maplewood County", kind: "intersection" },
  { id: "loc-regional-medical", label: "Maplewood Regional Medical Center, 500 Hospital Drive, Ridgemont", kind: "landmark" },
  { id: "loc-high-school", label: "Ridgemont High School, 1 Eagle Drive, Ridgemont", kind: "landmark" },
  { id: "loc-industrial", label: "Clearfield Industrial Park, Building 4, Clearfield", kind: "landmark" },
  { id: "loc-lantern-bar", label: "900 Lantern Street, Ridgemont", kind: "address" },
  { id: "loc-plaza-lot", label: "42 North Lot, Ridgemont Plaza, Ridgemont", kind: "address" },
  { id: "loc-brush-hollow", label: "County Road 12 & Brush Hollow, Maplewood County", kind: "intersection" },
  { id: "loc-interstate", label: "Interstate 47 westbound ramp, Mile Marker 18, Maplewood County", kind: "intersection" },
  { id: "loc-market-square", label: "15 Market Square, Ridgemont", kind: "address" },
  { id: "loc-cedar-post", label: "220 Cedar Post Road, Clearfield", kind: "address" },
  { id: "loc-harbor-alarm", label: "880 Harbor Alarm Way, Clearfield", kind: "address" },
  { id: "loc-nightingale", label: "640 Nightingale Lane, Maplewood County", kind: "address" },
  { id: "loc-pine-switch", label: "77 Pine Switch Road, Maplewood County", kind: "address" },
];

const byId = new Map(MAPLEWOOD_LOCATIONS.map((location) => [location.id, location]));

export function locationLabel(locationId: string): string {
  return byId.get(locationId)?.label ?? locationId;
}

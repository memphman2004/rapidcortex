"use client";

import dynamic from "next/dynamic";
import type { VenueLocationMapProps } from "./VenueLocationMap";

const VenueLocationMapClient = dynamic(
  () => import("./VenueLocationMap").then((mod) => mod.VenueLocationMap),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          background: "#141220",
          border: "1px solid #1e1a30",
          borderRadius: 8,
          height: 260,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "#2d2445" }}>Initializing map…</span>
      </div>
    ),
  },
);

export function VenueLocationMapDynamic(props: VenueLocationMapProps) {
  return <VenueLocationMapClient {...props} />;
}

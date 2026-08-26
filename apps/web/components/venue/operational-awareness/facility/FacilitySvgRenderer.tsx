"use client";

import type { FacilityMapRendererProps, SvgZoneGeometry, VenueOperationalZone } from "rapid-cortex-shared";
import { memo, useMemo } from "react";
import { STADIUM_VIEWBOX } from "@/lib/venue/operational-awareness/demo-stadium-geometry";
import { FACILITY_MARKER_COLORS, assetTypeToFacilityLayer } from "@/lib/venue/operational-awareness/layers";
import { StadiumStructure } from "./StadiumStructure";

function zoneFill(zone: VenueOperationalZone, selected: boolean): string {
  if (selected) return "rgba(249,115,22,0.42)";
  if (zone.status === "incident") return "rgba(239,68,68,0.38)";
  if (zone.status === "attention") return "rgba(245,158,11,0.32)";
  if (zone.type === "field") return "rgba(34,197,94,0.18)";
  if (zone.type === "restricted") return "rgba(148,163,184,0.22)";
  return "rgba(100,116,139,0.22)";
}

function ZoneShape({
  geometry,
  fill,
  stroke,
  strokeWidth,
  className,
  tabIndex,
  role,
  ariaLabel,
  ariaPressed,
  onClick,
  onKeyDown,
}: {
  geometry: SvgZoneGeometry;
  fill: string;
  stroke: string;
  strokeWidth: number;
  className?: string;
  tabIndex?: number;
  role?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  onClick?: () => void;
  onKeyDown?: (event: { key: string; preventDefault: () => void }) => void;
}) {
  const common = {
    fill,
    stroke,
    strokeWidth,
    className,
    tabIndex,
    role,
    "aria-label": ariaLabel,
    "aria-pressed": ariaPressed,
    onClick,
    onKeyDown,
  };
  if (geometry.kind === "path") {
    return <path d={geometry.d} {...common} />;
  }
  if (geometry.kind === "ellipse") {
    return <ellipse cx={geometry.cx} cy={geometry.cy} rx={geometry.rx} ry={geometry.ry} {...common} />;
  }
  return (
    <rect
      x={geometry.x}
      y={geometry.y}
      width={geometry.width}
      height={geometry.height}
      rx={geometry.rx ?? 0}
      {...common}
    />
  );
}

export const FacilitySvgRenderer = memo(function FacilitySvgRenderer({
  venue,
  activeLevelId,
  selectedIncidentId,
  selectedZoneId,
  visibleLayers,
  onIncidentSelect,
  onZoneSelect,
  onAssetSelect,
  viewTransform,
}: FacilityMapRendererProps & {
  viewTransform: { x: number; y: number; scale: number; rotation: number };
}) {
  const layers = useMemo(() => new Set(visibleLayers), [visibleLayers]);

  return (
    <svg
      viewBox={`0 0 ${STADIUM_VIEWBOX.width} ${STADIUM_VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label="Illustrative facility layout"
    >
      <g
        style={{ transition: "transform 280ms ease" }}
        transform={`translate(${STADIUM_VIEWBOX.width / 2} ${STADIUM_VIEWBOX.height / 2}) rotate(${viewTransform.rotation}) scale(${viewTransform.scale}) translate(${viewTransform.x - STADIUM_VIEWBOX.width / 2} ${viewTransform.y - STADIUM_VIEWBOX.height / 2})`}
      >
        <StadiumStructure />
        {venue.zones.map((zone) => {
          const dimmed = Boolean(activeLevelId) && zone.levelId !== activeLevelId && zone.type !== "field";
          if (zone.type === "restricted" && !layers.has("restricted")) return null;
          if (zone.type !== "restricted" && zone.type !== "field" && !layers.has("operationalZones")) {
            return null;
          }
          const selected = zone.id === selectedZoneId;
          return (
            <g key={zone.id} opacity={dimmed ? 0.2 : 1}>
              <ZoneShape
                geometry={zone.geometry}
                fill={zoneFill(zone, selected)}
                stroke={selected ? "#fb923c" : zone.status === "incident" ? "#ef4444" : "#64748b"}
                strokeWidth={selected ? 2.4 : 1}
                className="cursor-pointer"
                tabIndex={dimmed ? -1 : 0}
                role="button"
                ariaLabel={`${zone.name}${zone.status === "incident" ? ", incident" : ""}`}
                ariaPressed={selected}
                onClick={() => onZoneSelect(zone.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onZoneSelect(zone.id);
                  }
                }}
              />
              {zone.labelX != null && zone.labelY != null && !dimmed ? (
                <text
                  x={zone.labelX}
                  y={zone.labelY}
                  textAnchor="middle"
                  className="pointer-events-none"
                  fill="#f8fafc"
                  fontSize={zone.type === "field" ? 11 : 9}
                  fontWeight={700}
                  letterSpacing="0.06em"
                >
                  {zone.name.toUpperCase()}
                </text>
              ) : null}
            </g>
          );
        })}

        {venue.assets.map((asset) => {
          const layer = assetTypeToFacilityLayer(asset.type);
          if (!layers.has(layer)) return null;
          if (activeLevelId && asset.levelId && asset.levelId !== activeLevelId) return null;
          const point = asset.interiorCoordinates;
          if (!point) return null;
          const color = FACILITY_MARKER_COLORS[asset.type] ?? "#94a3b8";
          return (
            <g
              key={asset.id}
              transform={`translate(${point.x} ${point.y})`}
              className="cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                onAssetSelect(asset.id);
              }}
              tabIndex={0}
              role="button"
              aria-label={`${asset.name}, ${asset.type}${asset.status ? `, ${asset.status}` : ""}`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onAssetSelect(asset.id);
                }
              }}
            >
              <circle r={7} fill={color} stroke="#0f1117" strokeWidth={1.5} />
              <circle r={2.2} fill="#fff" />
            </g>
          );
        })}

        {layers.has("incidents")
          ? venue.demoIncidents?.map((incident) => {
              if (activeLevelId && incident.levelId !== activeLevelId) return null;
              const zone = venue.zones.find((item) => item.id === incident.zoneId);
              const x = zone?.labelX ?? STADIUM_VIEWBOX.cx;
              const y = (zone?.labelY ?? STADIUM_VIEWBOX.cy) - 18;
              const selected = incident.id === selectedIncidentId;
              return (
                <g
                  key={incident.id}
                  transform={`translate(${x} ${y})`}
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onIncidentSelect(incident.id);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${incident.title}, ${incident.locationLabel}, ${incident.status}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onIncidentSelect(incident.id);
                    }
                  }}
                >
                  <path
                    d="M0 -14 C 6 -14 10 -8 10 -4 C 10 2 0 12 0 12 C 0 12 -10 2 -10 -4 C -10 -8 -6 -14 0 -14 Z"
                    fill={FACILITY_MARKER_COLORS.incident}
                    stroke={selected ? "#fff" : "#7f1d1d"}
                    strokeWidth={selected ? 2 : 1}
                  />
                  <circle cy={-5} r={2.4} fill="#fff" />
                </g>
              );
            })
          : null}
      </g>
    </svg>
  );
});

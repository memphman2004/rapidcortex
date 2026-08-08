"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  PSAP_OUTREACH_STATUS_CONFIG,
  PSAP_OUTREACH_STATUSES,
  type PsapMapPin,
  type PsapOutreachStatus,
} from "rapid-cortex-shared";
import { RapidCortexMap } from "rapid-cortex-maps";
import { getPsapProspect } from "@/lib/psap/psap-api";
import type { PsapProspect } from "rapid-cortex-shared";

const US_CENTER: [number, number] = [-98.5795, 39.8283];
const SOURCE_ID = "psap-prospect-pins";
const CLUSTER_LAYER = "psap-clusters";
const CLUSTER_COUNT = "psap-cluster-count";
const UNCLUSTERED = "psap-unclustered";

type Props = {
  pins: PsapMapPin[];
  statusFilter?: PsapOutreachStatus;
  onSelectProspect: (prospect: PsapProspect) => void;
  isLoading?: boolean;
};

export function PsapMapView({ pins, statusFilter, onSelectProspect, isLoading }: Props) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectingRef = useRef(false);

  const filtered = useMemo(() => {
    if (!statusFilter) return pins;
    return pins.filter((p) => p.status === statusFilter);
  }, [pins, statusFilter]);

  const geojson = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: filtered.map((p) => ({
        type: "Feature",
        properties: {
          psapId: p.psapId,
          status: p.status,
          psapName: p.psapName,
          state: p.state,
          color: PSAP_OUTREACH_STATUS_CONFIG[p.status].mapPinColor,
        },
        geometry: {
          type: "Point",
          coordinates: [p.lon, p.lat],
        },
      })),
    }),
    [filtered],
  );

  useEffect(() => {
    if (!map) return;

    const ensure = () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterMaxZoom: 8,
          clusterRadius: 42,
        });
        map.addLayer({
          id: CLUSTER_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#3b82f6",
            "circle-radius": ["step", ["get", "point_count"], 14, 25, 18, 100, 24],
            "circle-opacity": 0.85,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#0f1117",
          },
        });
        map.addLayer({
          id: CLUSTER_COUNT,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 11,
          },
          paint: { "text-color": "#e2e8f0" },
        });
        map.addLayer({
          id: UNCLUSTERED,
          type: "circle",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 5,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#0f1117",
          },
        });
      } else {
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
        src.setData(geojson);
      }
    };

    if (map.isStyleLoaded()) ensure();
    else map.once("load", ensure);

    const onClusterClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
      if (clusterId == null) return;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return;
        const coords = (features[0]!.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom });
      });
    };

    const onPinClick = async (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const psapId = feature?.properties?.psapId as string | undefined;
      if (!psapId || selectingRef.current) return;
      selectingRef.current = true;
      try {
        const prospect = await getPsapProspect(psapId);
        onSelectProspect(prospect);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load PSAP");
      } finally {
        selectingRef.current = false;
      }
    };

    map.on("click", CLUSTER_LAYER, onClusterClick);
    map.on("click", UNCLUSTERED, onPinClick);
    map.on("mouseenter", UNCLUSTERED, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", UNCLUSTERED, () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.off("click", CLUSTER_LAYER, onClusterClick);
      map.off("click", UNCLUSTERED, onPinClick);
      map.off("load", ensure);
    };
  }, [map, geojson, onSelectProspect]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  const tokenMissing = !token || token === "pk.REPLACE_WITH_REAL_TOKEN";

  if (tokenMissing) {
    return (
      <div className="flex h-[560px] items-center justify-center rounded-lg border border-[#1e2130] bg-[#0f1117] text-sm text-slate-500">
        Map isn’t configured for this environment.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#1e2130] bg-[#0f1117]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1e2130] px-3 py-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Status colors
        </span>
        {PSAP_OUTREACH_STATUSES.filter((s) => s !== "UNCONTACTED" && s !== "DO_NOT_CONTACT").map(
          (s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: PSAP_OUTREACH_STATUS_CONFIG[s].mapPinColor }}
              />
              {PSAP_OUTREACH_STATUS_CONFIG[s].label}
            </span>
          ),
        )}
        <span className="ml-auto font-mono text-[11px] text-slate-500">
          {isLoading ? "Loading…" : `${filtered.length.toLocaleString()} pins`}
        </span>
      </div>
      {error && (
        <p className="border-b border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">
          {error}
        </p>
      )}
      <div className="relative h-[560px]">
        <RapidCortexMap
          center={US_CENTER}
          zoom={3.4}
          theme="dark"
          showControls
          className="h-full w-full"
          onMapLoad={setMap}
        />
      </div>
    </div>
  );
}

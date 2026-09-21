"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  PSAP_OUTREACH_STATUS_CONFIG,
  PSAP_OUTREACH_STATUSES,
  type PsapMapPin,
  type PsapOutreachStatus,
} from "rapid-cortex-shared";
import { RapidCortexMap } from "rapid-cortex-maps";
import { getPsapProspect } from "@/lib/psap/psap-api";
import type { PsapProspect } from "rapid-cortex-shared";
import {
  PSAP_ICON_ID,
  PSAP_ICON_URL,
  buildPsapPopupHTML,
} from "@/components/maps/psap-overlay";

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
  const [map, setMap] = useState<maplibregl.Map | null>(null);
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
          id: p.psapId,
          psapId: p.psapId,
          name: p.psapName,
          status: p.status,
          city: p.city ?? "",
          county: p.county ?? "",
          state: p.state,
          phone: p.phone ?? "",
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

    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: "280px",
      className: "rc-map-popup",
    });

    const ensure = async () => {
      if (!map.hasImage(PSAP_ICON_ID)) {
        try {
          const image = await map.loadImage(PSAP_ICON_URL);
          if (!map.hasImage(PSAP_ICON_ID)) {
            map.addImage(PSAP_ICON_ID, image.data, { pixelRatio: 2 });
          }
        } catch {
          /* fall through — circle layer is added if the icon is missing */
        }
      }
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
            "circle-color": "#eab308",
            "circle-radius": ["step", ["get", "point_count"], 14, 25, 18, 100, 24],
            "circle-opacity": 0.9,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#422006",
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
          paint: { "text-color": "#1c1917" },
        });
        if (map.hasImage(PSAP_ICON_ID)) {
          map.addLayer({
            id: UNCLUSTERED,
            type: "symbol",
            source: SOURCE_ID,
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": PSAP_ICON_ID,
              "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.45, 10, 0.7, 15, 0.95],
              "icon-allow-overlap": true,
              "text-field": ["step", ["zoom"], "", 7, ["get", "name"]],
              "text-size": 11,
              "text-offset": [0, 1.25],
              "text-anchor": "top",
              "text-optional": true,
            },
            paint: {
              "text-color": "#fde68a",
              "text-halo-color": "#0f1117",
              "text-halo-width": 1.2,
            },
          });
        } else {
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
        }
      } else {
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
        src.setData(geojson);
      }
    };

    const onLoad = () => {
      void ensure();
    };
    if (map.isStyleLoaded()) void ensure();
    else map.once("load", onLoad);

    const onClusterClick = (e: maplibregl.MapLayerMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
      if (clusterId == null) return;
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        if (zoom == null) return;
        const coords = (features[0]!.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom });
      });
    };

    const onPinClick = async (e: maplibregl.MapLayerMouseEvent) => {
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

    const onPinEnter = (e: maplibregl.MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const props = feature.properties ?? {};
      const status = props.status as PsapOutreachStatus | undefined;
      const statusLabel = status ? PSAP_OUTREACH_STATUS_CONFIG[status]?.label : "";
      hoverPopup
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(
          buildPsapPopupHTML({
            name: String(props.name ?? ""),
            city: String(props.city ?? ""),
            state: String(props.state ?? ""),
            county: String(props.county ?? ""),
            phone: String(props.phone ?? ""),
            statusLabel,
          }),
        )
        .addTo(map);
    };

    const onPinLeave = () => {
      map.getCanvas().style.cursor = "";
      hoverPopup.remove();
    };

    map.on("click", CLUSTER_LAYER, onClusterClick);
    map.on("click", UNCLUSTERED, onPinClick);
    map.on("mouseenter", UNCLUSTERED, onPinEnter);
    map.on("mouseleave", UNCLUSTERED, onPinLeave);

    return () => {
      hoverPopup.remove();
      map.off("click", CLUSTER_LAYER, onClusterClick);
      map.off("click", UNCLUSTERED, onPinClick);
      map.off("mouseenter", UNCLUSTERED, onPinEnter);
      map.off("mouseleave", UNCLUSTERED, onPinLeave);
      map.off("load", onLoad);
    };
  }, [map, geojson, onSelectProspect]);

  const tokenMissing = false;

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

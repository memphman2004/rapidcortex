"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Map as MapIcon, X } from "lucide-react";
import {
  PSAP_OUTREACH_STATUS_CONFIG,
  type PsapMapPin,
} from "rapid-cortex-shared";
import { RapidCortexMap } from "rapid-cortex-maps";
import {
  fetchPlatformDeploymentsMap,
  type AgencyDeploymentsMapPayload,
} from "@/lib/api";
import { getPsapMapPins } from "@/lib/psap/psap-api";
import { isDeploymentsMapEnabled, isPsapProspectsUiEnabled } from "@/lib/runtime-flags";

type Marker = AgencyDeploymentsMapPayload["markers"][number];
type Vertical = "core" | "campus" | "venue" | "hospital";
type SortKey = "name" | "vertical" | "status" | "state";

const US_CENTER: [number, number] = [-98.5795, 39.8283];

/** Dot fill = product vertical (customer category). */
const VERTICAL_COLOR: Record<Vertical, string> = {
  core: "#a78bfa",
  campus: "#34d399",
  venue: "#f59e0b",
  hospital: "#2dd4bf",
};

const VERTICAL_LABEL: Record<Vertical, string> = {
  core: "Core / PSAP",
  campus: "Campus",
  venue: "Venue",
  hospital: "Hospital",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  pilot: "Pilot",
  draft: "Draft",
  suspended: "Suspended",
  archived: "Archived",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveVertical(marker: Marker): Vertical {
  const v = (marker.vertical ?? "").toLowerCase();
  if (v === "campus" || v === "venue" || v === "hospital") return v;
  if (marker.type === "campus") return "campus";
  if (marker.type === "venue") return "venue";
  return "core";
}

function popupHtml(marker: Marker): string {
  const vertical = resolveVertical(marker);
  const place = [marker.city, marker.state].filter(Boolean).join(", ");
  const color = VERTICAL_COLOR[vertical];
  return `
    <div style="background:#0f1117;border:1px solid #1e1b2e;border-radius:6px;padding:10px 12px;min-width:180px;font-family:inherit;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
        <span style="font-size:10px;font-weight:700;color:${color};letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(VERTICAL_LABEL[vertical])}</span>
      </div>
      <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:4px;">${escapeHtml(marker.name)}</div>
      <div style="font-size:10px;color:#64748b;margin-bottom:4px;font-family:ui-monospace,monospace;">${escapeHtml(marker.agencyId)}</div>
      <div style="font-size:10px;color:#94a3b8;">${escapeHtml(place || marker.state)} · ${escapeHtml(STATUS_LABEL[marker.status] ?? marker.status)}</div>
    </div>
  `;
}

function AgencyPin({
  map,
  marker,
  selected,
  onHover,
  onSelect,
}: {
  map: mapboxgl.Map | null;
  marker: Marker;
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  useEffect(() => {
    if (!map) return;

    const vertical = resolveVertical(marker);
    const fill = VERTICAL_COLOR[vertical];

    const mount = () => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: ${selected ? 16 : 12}px;
        height: ${selected ? 16 : 12}px;
        border-radius: 50%;
        background: ${fill};
        border: 2px solid #0f1117;
        box-shadow: 0 0 10px ${fill}88;
        cursor: pointer;
        transition: transform 0.15s ease, width 0.15s ease, height 0.15s ease;
      `;

      const popup = new mapboxgl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "260px",
        className: "rc-map-popup",
      }).setHTML(popupHtml(marker));

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.45)";
        onHover(marker.agencyId);
        popup.setLngLat([marker.longitude, marker.latitude]).addTo(map);
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        onHover(null);
        popup.remove();
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(marker.agencyId);
      });

      const next = new mapboxgl.Marker({ element: el })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);

      markerRef.current?.remove();
      popupRef.current?.remove();
      markerRef.current = next;
      popupRef.current = popup;
    };

    if (map.isStyleLoaded()) mount();
    else map.once("load", mount);

    return () => {
      map.off("load", mount);
      popupRef.current?.remove();
      markerRef.current?.remove();
      popupRef.current = null;
      markerRef.current = null;
    };
  }, [map, marker, selected, onHover, onSelect]);

  return null;
}

function useFitBounds(
  map: mapboxgl.Map | null,
  points: Array<{ latitude: number; longitude: number }>,
) {
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.flyTo({
        center: [points[0].longitude, points[0].latitude],
        zoom: 6,
        duration: 700,
      });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    for (const p of points) bounds.extend([p.longitude, p.latitude]);
    map.fitBounds(bounds, { padding: 48, maxZoom: 8, duration: 700 });
  }, [map, points]);
}

export type DeploymentsMapPanelProps = {
  /** Compact preview for the RC Admin dashboard home. */
  compact?: boolean;
  className?: string;
  /** Show PSAP Prospects overlay toggle (finance-portal roles + feature flag). */
  showPsapProspectsLayer?: boolean;
};

function PsapProspectPin({
  map,
  pin,
}: {
  map: mapboxgl.Map | null;
  pin: PsapMapPin;
}) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  useEffect(() => {
    if (!map) return;
    if (pin.status === "UNCONTACTED") return;

    const fill = PSAP_OUTREACH_STATUS_CONFIG[pin.status].mapPinColor;
    const mount = () => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: ${fill};
        border: 1px solid #0f1117;
        opacity: 0.9;
        cursor: default;
      `;
      const popup = new mapboxgl.Popup({
        offset: 10,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "220px",
        className: "rc-map-popup",
      }).setHTML(`
        <div style="background:#0f1117;border:1px solid #1e1b2e;border-radius:6px;padding:8px 10px;font-size:11px;color:#e2e8f0;">
          <div style="font-weight:700;margin-bottom:2px;">${escapeHtml(pin.psapName)}</div>
          <div style="color:#94a3b8;">${escapeHtml(pin.state)} · ${escapeHtml(PSAP_OUTREACH_STATUS_CONFIG[pin.status].label)}</div>
        </div>
      `);
      el.addEventListener("mouseenter", () => {
        popup.setLngLat([pin.lon, pin.lat]).addTo(map);
      });
      el.addEventListener("mouseleave", () => popup.remove());
      const next = new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lon, pin.lat])
        .addTo(map);
      markerRef.current?.remove();
      popupRef.current?.remove();
      markerRef.current = next;
      popupRef.current = popup;
    };

    if (map.isStyleLoaded()) mount();
    else map.once("load", mount);

    return () => {
      map.off("load", mount);
      popupRef.current?.remove();
      markerRef.current?.remove();
      popupRef.current = null;
      markerRef.current = null;
    };
  }, [map, pin]);

  return null;
}

export function DeploymentsMapPanel({
  compact = false,
  className = "",
  showPsapProspectsLayer = false,
}: DeploymentsMapPanelProps) {
  const enabled = isDeploymentsMapEnabled();
  const psapLayerAllowed = showPsapProspectsLayer && isPsapProspectsUiEnabled();
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("vertical");
  const [sortAsc, setSortAsc] = useState(true);
  const [verticalFilter, setVerticalFilter] = useState<Vertical | "all">("all");
  const [psapLayerOn, setPsapLayerOn] = useState(false);

  const query = useQuery({
    queryKey: ["platform", "deployments-map"],
    queryFn: fetchPlatformDeploymentsMap,
    enabled,
    retry: false,
  });

  const psapPinsQuery = useQuery({
    queryKey: ["psap-prospects", "map-pins", "deployments-overlay"],
    queryFn: getPsapMapPins,
    enabled: enabled && psapLayerAllowed && psapLayerOn && !compact,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const psapPins = useMemo(
    () => (psapPinsQuery.data ?? []).filter((p) => p.status !== "UNCONTACTED"),
    [psapPinsQuery.data],
  );

  const markers = query.data?.markers ?? [];
  const missing = query.data?.missingCoordinatesCount ?? 0;
  const total = query.data?.totalAgencies ?? 0;

  const filteredSorted = useMemo(() => {
    const list = markers.filter((m) => {
      if (verticalFilter === "all") return true;
      return resolveVertical(m) === verticalFilter;
    });
    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "vertical") {
        return resolveVertical(a).localeCompare(resolveVertical(b)) * dir;
      }
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
      return (a.state || "").localeCompare(b.state || "") * dir;
    });
  }, [markers, sortKey, sortAsc, verticalFilter]);

  const selected = useMemo(
    () => markers.find((m) => m.agencyId === selectedId) ?? null,
    [markers, selectedId],
  );

  useEffect(() => {
    if (!map) return;
    const onError = () => setMapError("Map failed to load.");
    map.on("error", onError);
    return () => {
      map.off("error", onError);
    };
  }, [map]);

  useFitBounds(map, markers);

  useEffect(() => {
    if (!map || !selected) return;
    map.flyTo({
      center: [selected.longitude, selected.latitude],
      zoom: Math.max(map.getZoom(), 6),
      duration: 600,
    });
  }, [map, selected]);

  const onHover = useCallback((id: string | null) => setHoveredId(id), []);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  const tokenMissing = !token || token === "pk.REPLACE_WITH_REAL_TOKEN";
  const mapHeight = compact ? 220 : 560;

  const legend = useMemo(
    () =>
      (Object.keys(VERTICAL_LABEL) as Vertical[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => setVerticalFilter((cur) => (cur === key ? "all" : key))}
          className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] transition-colors ${
            verticalFilter === key
              ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: VERTICAL_COLOR[key] }}
          />
          {VERTICAL_LABEL[key]}
        </button>
      )),
    [verticalFilter],
  );

  if (!enabled) return null;

  const mapBody = (() => {
    if (tokenMissing) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
          Set <code className="mx-1 text-violet-300">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to
          render the deployments map.
        </div>
      );
    }
    if (query.isLoading) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Loading deployments…
        </div>
      );
    }
    if (query.isError) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-300">
          {query.error instanceof Error ? query.error.message : "Could not load deployments map"}
        </div>
      );
    }
    if (mapError) {
      return <div className="flex h-full items-center justify-center text-sm text-rose-300">{mapError}</div>;
    }
    if (markers.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
          <p>No agency HQ coordinates yet.</p>
          <p className="text-xs text-slate-600">
            Set latitude/longitude on create agency or the agency profile to pin tenants here.
          </p>
        </div>
      );
    }
    return (
      <RapidCortexMap
        center={US_CENTER}
        zoom={3.4}
        theme="dark"
        showControls={!compact}
        className="h-full w-full"
        onMapLoad={setMap}
      >
        {markers.map((m) => (
          <AgencyPin
            key={m.agencyId}
            map={map}
            marker={m}
            selected={selectedId === m.agencyId || hoveredId === m.agencyId}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
        {psapLayerOn &&
          psapPins.map((p) => <PsapProspectPin key={p.psapId} map={map} pin={p} />)}
      </RapidCortexMap>
    );
  })();

  if (compact) {
    return (
      <div
        className={`overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
          <div className="flex items-center gap-2">
            <MapIcon className="h-3.5 w-3.5 text-violet-400" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              National deployments
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] text-slate-400">
              {markers.length} mapped
              {total > 0 ? ` · ${missing} missing HQ` : null}
            </span>
            <Link
              href="/rc-admin/deployments-map"
              className="text-[11px] hover:opacity-90"
              style={{ color: "var(--role-accent, #a78bfa)" }}
            >
              Open map →
            </Link>
          </div>
        </div>
        <div className="relative" style={{ height: mapHeight }}>
          {mapBody}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <MapIcon className="h-3.5 w-3.5 text-violet-400" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            National deployments
          </p>
        </div>
        <span className="font-mono text-[11px] text-slate-400">
          {markers.length} mapped
          {total > 0 ? ` · ${missing} missing HQ` : null}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/80 px-3 py-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Vertical
        </span>
        <button
          type="button"
          onClick={() => setVerticalFilter("all")}
          className={`rounded border px-2 py-0.5 text-[10px] ${
            verticalFilter === "all"
              ? "border-slate-500 bg-slate-800 text-slate-200"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          All
        </button>
        {legend}
        {psapLayerAllowed && (
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-700/80 px-2 py-0.5 text-[10px] text-slate-300">
            <input
              type="checkbox"
              checked={psapLayerOn}
              onChange={(e) => setPsapLayerOn(e.target.checked)}
              className="rounded border-slate-600"
            />
            PSAP Prospects Layer
            {psapLayerOn && psapPinsQuery.isFetching ? (
              <span className="text-slate-500">…</span>
            ) : psapLayerOn ? (
              <span className="font-mono text-slate-500">{psapPins.length}</span>
            ) : null}
          </label>
        )}
      </div>

      <div
        className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)_minmax(0,260px)]"
        style={{ minHeight: mapHeight }}
      >
        {/* Map */}
        <div className="relative border-b border-slate-800 lg:border-b-0 lg:border-r" style={{ height: mapHeight }}>
          {mapBody}
        </div>

        {/* Sortable customer list */}
        <div
          className="flex flex-col border-b border-slate-800 lg:border-b-0 lg:border-r"
          style={{ maxHeight: mapHeight }}
        >
          <div className="flex items-center gap-1 border-b border-slate-800 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Customers
            </span>
            <span className="ml-auto font-mono text-[10px] text-slate-600">
              {filteredSorted.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-slate-800/80 px-2 py-1.5">
            {(
              [
                ["vertical", "Vertical"],
                ["name", "Name"],
                ["status", "Status"],
                ["state", "State"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] ${
                  sortKey === key ? "bg-violet-500/15 text-violet-200" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
                {sortKey === key ? <ArrowUpDown className="h-2.5 w-2.5" /> : null}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {query.isLoading ? (
              <p className="p-3 text-xs text-slate-500">Loading…</p>
            ) : filteredSorted.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">No mapped customers in this filter.</p>
            ) : (
              filteredSorted.map((m) => {
                const vertical = resolveVertical(m);
                const active = selectedId === m.agencyId || hoveredId === m.agencyId;
                return (
                  <button
                    key={m.agencyId}
                    type="button"
                    onMouseEnter={() => setHoveredId(m.agencyId)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId(m.agencyId)}
                    className={`flex w-full items-start gap-2.5 border-b border-slate-800/60 px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-violet-500/10" : "hover:bg-slate-900/80"
                    }`}
                  >
                    <span
                      className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: VERTICAL_COLOR[vertical] }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-slate-200">
                        {m.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {VERTICAL_LABEL[vertical]} · {STATUS_LABEL[m.status] ?? m.status}
                        {m.state ? ` · ${m.state}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail column */}
        <div className="flex flex-col" style={{ minHeight: mapHeight }}>
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Customer detail
            </span>
            {selected ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded p-0.5 text-slate-500 hover:text-slate-300"
                aria-label="Close detail"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {!selected ? (
              <p className="text-xs leading-relaxed text-slate-500">
                Hover a map pin for a quick preview. Click a pin or list row to open full customer
                details here.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: VERTICAL_COLOR[resolveVertical(selected)] }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: VERTICAL_COLOR[resolveVertical(selected)] }}
                  >
                    {VERTICAL_LABEL[resolveVertical(selected)]}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{selected.name}</h3>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">{selected.agencyId}</p>
                </div>
                <dl className="space-y-2 text-[11px]">
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd className="text-slate-200">{STATUS_LABEL[selected.status] ?? selected.status}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Type</dt>
                    <dd className="text-slate-200">{selected.type}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Location</dt>
                    <dd className="text-slate-200">
                      {[selected.city, selected.state, selected.region].filter(Boolean).join(", ") ||
                        "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Coordinates</dt>
                    <dd className="font-mono text-slate-300">
                      {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/rc-admin/agencies/${encodeURIComponent(selected.agencyId)}/features`}
                  className="inline-flex items-center rounded border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20"
                >
                  Open agency →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .rc-map-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        .rc-map-popup .mapboxgl-popup-tip {
          display: none !important;
        }
      `}</style>
    </div>
  );
}

"use client";

import { Copy, ExternalLink, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isCallControlWebSocketEnabled } from "@/lib/runtime-flags";
import type { CampusIncidentLocationEntry } from "@/lib/campus/types";

type LocationWsMessage = {
  type: string;
  data?: {
    incidentId?: string;
    source?: "GPS" | "CELL_TOWER" | "MANUAL";
    coordinates?: { latitude: number; longitude: number; accuracy: number };
    accuracyMeters?: number;
    locationText?: string;
    receivedAt?: string;
  };
};

function sourceLabel(source: CampusIncidentLocationEntry["source"]): string {
  if (source === "GPS") return "GPS (Student-shared)";
  if (source === "CELL_TOWER") return "Cell Tower Estimate";
  return "Manual";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function SmsLocationPanel({
  incidentId,
  initialLocations,
  locationLinkSent,
  reporterLast4,
}: {
  incidentId: string;
  initialLocations?: CampusIncidentLocationEntry[];
  locationLinkSent?: boolean;
  reporterLast4?: string;
}) {
  const [locations, setLocations] = useState<CampusIncidentLocationEntry[]>(initialLocations ?? []);

  useEffect(() => {
    setLocations(initialLocations ?? []);
  }, [initialLocations]);

  const sorted = useMemo(
    () => [...locations].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()),
    [locations],
  );

  const gpsEntry = sorted.find((l) => l.source === "GPS");
  const cellEntry = sorted.find((l) => l.source === "CELL_TOWER");
  const manualEntry = sorted.find((l) => l.source === "MANUAL");

  const onWsMessage = useCallback(
    (msg: LocationWsMessage) => {
      if (msg.type !== "LOCATION_RECEIVED") return;
      if (msg.data?.incidentId !== incidentId) return;
      const entry: CampusIncidentLocationEntry = {
        source: msg.data.source ?? "GPS",
        accuracyMeters: msg.data.accuracyMeters,
        receivedAt: msg.data.receivedAt ?? new Date().toISOString(),
        locationText: msg.data.locationText,
        coordinates: msg.data.coordinates,
      };
      setLocations((prev) => [...prev, entry]);
    },
    [incidentId],
  );

  useEffect(() => {
    if (!isCallControlWebSocketEnabled()) return;
    const base = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim();
    if (!base) return;
    const ws = new WebSocket(base);
    ws.onmessage = (ev) => {
      try {
        onWsMessage(JSON.parse(String(ev.data)) as LocationWsMessage);
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [onWsMessage]);

  const copyCoords = (lat: number, lng: number) => {
    void navigator.clipboard.writeText(`${lat},${lng}`);
  };

  if (sorted.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Awaiting location — link sent to reporter
        </div>
        {locationLinkSent ? (
          <p className="mt-1 text-xs text-slate-500">GPS link delivered via SMS</p>
        ) : null}
        {reporterLast4 ? (
          <p className="mt-2 text-xs text-slate-500">Reporter: {reporterLast4}</p>
        ) : null}
      </div>
    );
  }

  const renderEntry = (entry: CampusIncidentLocationEntry, moreAccurate?: boolean) => (
    <div key={`${entry.source}-${entry.receivedAt}`} className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-slate-200">
        <MapPin className="h-4 w-4 text-emerald-400" />
        Location Received
        {moreAccurate ? (
          <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
            More Accurate
          </span>
        ) : null}
      </div>
      <dl className="mt-2 space-y-1 text-xs text-slate-400">
        <div className="flex gap-2">
          <dt className="text-slate-500">Source</dt>
          <dd className="text-slate-200">{sourceLabel(entry.source)}</dd>
        </div>
        {entry.accuracyMeters != null ? (
          <div className="flex gap-2">
            <dt className="text-slate-500">Accuracy</dt>
            <dd className="text-slate-200">~{Math.round(entry.accuracyMeters)} meters</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="text-slate-500">Time</dt>
          <dd className="text-slate-200">{formatTime(entry.receivedAt)}</dd>
        </div>
        {entry.locationText ? (
          <div className="flex gap-2">
            <dt className="text-slate-500">Details</dt>
            <dd className="text-slate-200">{entry.locationText}</dd>
          </div>
        ) : null}
      </dl>
      {entry.coordinates ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyCoords(entry.coordinates!.latitude, entry.coordinates!.longitude)}
            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            <Copy className="h-3 w-3" />
            Copy Coordinates
          </button>
          <a
            href={`https://maps.google.com/maps?q=${entry.coordinates.latitude},${entry.coordinates.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            <ExternalLink className="h-3 w-3" />
            Open in Maps
          </a>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="mt-3 space-y-2">
      {reporterLast4 ? <p className="text-xs text-slate-500">Reporter: {reporterLast4}</p> : null}
      {gpsEntry ? renderEntry(gpsEntry, Boolean(cellEntry)) : null}
      {cellEntry && (!gpsEntry || cellEntry.receivedAt !== gpsEntry.receivedAt)
        ? renderEntry(cellEntry)
        : null}
      {manualEntry && manualEntry !== gpsEntry && manualEntry !== cellEntry ? renderEntry(manualEntry) : null}
    </div>
  );
}

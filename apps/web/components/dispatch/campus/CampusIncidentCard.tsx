"use client";

import { ImageIcon, MapPin, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QrIncidentLocation } from "@/components/incidents/qr-incident-location";
import { SmsLocationPanel } from "@/components/dispatch/campus/sms-location-panel";
import { CampusWarRoomLauncher } from "@/components/campus/campus-war-room-launcher";
import { isSmsLocationEnabled } from "@/lib/runtime-flags";
import type { CampusIncident, CampusIncidentStatus } from "@/lib/campus/types";

function elapsedLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function statusLabel(status: CampusIncidentStatus): string {
  switch (status) {
    case "open":
      return "NEW";
    case "assigned":
      return "ACKNOWLEDGED";
    case "responding":
      return "RESPONDING";
    case "resolved":
      return "CLOSED";
    case "escalated":
      return "ESCALATED";
    default:
      return status.toUpperCase();
  }
}

function statusAccent(status: CampusIncidentStatus): string {
  switch (status) {
    case "open":
      return "border-l-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]";
    case "assigned":
      return "border-l-amber-400";
    case "responding":
      return "border-l-blue-400";
    case "resolved":
      return "border-l-slate-600 opacity-80";
    default:
      return "border-l-orange-400";
  }
}

function originLabel(source: CampusIncident["source"]): string {
  if (source === "qr") return "QR Scan";
  if (source === "sms") return "SMS";
  if (source === "phone") return "Phone";
  if (source === "vms") return "VMS";
  if (source === "alpr") return "ALPR";
  if (source === "alarm") return "Alarm";
  if (source === "sensor") return "Sensor";
  if (source === "webhook") return "Webhook";
  return "Direct";
}

function typeLabel(type: CampusIncident["type"]): string {
  const map: Record<string, string> = {
    medical: "Medical",
    security: "Safety",
    suspicious_activity: "Suspicious",
    mental_health: "Mental health",
    other: "Other",
  };
  return map[type] ?? type;
}

export function CampusIncidentCard({
  incident,
  campusCode,
  onAcknowledge,
  onEscalate,
  onClose,
}: {
  incident: CampusIncident;
  campusCode?: string;
  onAcknowledge: (id: string) => void;
  onEscalate: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(elapsedLabel(incident.createdAt));

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(elapsedLabel(incident.createdAt)), 30_000);
    return () => window.clearInterval(timer);
  }, [incident.createdAt]);

  const descriptionPreview = useMemo(() => {
    if (!incident.description) return "";
    if (expanded || incident.description.length <= 180) return incident.description;
    return `${incident.description.slice(0, 180)}…`;
  }, [expanded, incident.description]);

  return (
    <article
      className={`rounded-lg border border-slate-800 bg-slate-900/60 p-4 border-l-4 ${statusAccent(incident.status)}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-300">{incident.id}</span>
          {incident.siteCode ? (
            <span className="rounded-full border border-slate-700 px-2 py-0.5 font-semibold text-slate-200">
              {incident.siteCode}
            </span>
          ) : null}
          <span>{elapsed}</span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 font-semibold text-slate-200">
            {statusLabel(incident.status)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${
              incident.source === "qr"
                ? "bg-sky-950/60 text-sky-200"
                : incident.source === "sms"
                  ? "bg-emerald-950/60 text-emerald-200"
                  : "bg-slate-800 text-slate-300"
            }`}
          >
            {originLabel(incident.source)}
          </span>
        </div>
      </header>

      <div className="mt-3">
        <QrIncidentLocation
          source={incident.source}
          zoneCode={incident.zoneCode ?? incident.roomCode}
          zoneLabel={incident.zoneLabel}
          locationName={incident.qrLocationName}
          building={incident.buildingLabel}
          rcli={incident.qrRcli}
        />
      </div>

      {incident.source === "sms" && isSmsLocationEnabled() ? (
        <SmsLocationPanel
          incidentId={incident.id}
          initialLocations={incident.locationData}
          locationLinkSent={incident.locationLinkSent}
          reporterLast4={incident.reporterLast4}
        />
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-200">
        <span className="font-medium">{typeLabel(incident.type)}</span>
        {incident.hasMedia ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
            <ImageIcon className="h-3 w-3" />
            Media attached
          </span>
        ) : null}
        {incident.cleryCategorySuggested ? (
          <span className="rounded-full border border-amber-700/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
            Clery suggested: {incident.cleryCategorySuggested} (not filed)
          </span>
        ) : null}
      </div>

      {incident.eapChecklist?.steps?.length ? (
        <div className="mt-3 rounded-md border border-sky-900/50 bg-sky-950/20 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            EAP / checklist — {incident.eapChecklist.title}
          </div>
          <ol className="mt-1 list-decimal pl-4 text-xs text-slate-300">
            {incident.eapChecklist.steps.slice(0, 6).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {incident.cameraRefs && incident.cameraRefs.length > 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          Mapped cameras: {incident.cameraRefs.join(", ")}
          {campusCode ? (
            <>
              {" · "}
              <a
                href={`/app/campus/${encodeURIComponent(campusCode)}/cameras`}
                className="text-sky-400 hover:underline"
              >
                Live view
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {descriptionPreview ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {descriptionPreview}
          {incident.description.length > 180 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-2 text-xs text-sky-400 hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
        {incident.isAnonymous ? (
          <span>Anonymous report</span>
        ) : (
          <span>
            Named report
            {incident.assignedToName ? ` · assigned to ${incident.assignedToName}` : ""}
          </span>
        )}
        {incident.source === "qr" ? (
          <span className="ml-2 inline-flex items-center gap-1 text-emerald-300">
            <Radio className="h-3 w-3 animate-pulse" />
            Live location may be active
          </span>
        ) : null}
      </div>

      <footer className="mt-4 flex flex-wrap gap-2">
        {incident.status === "open" ? (
          <button
            type="button"
            onClick={() => onAcknowledge(incident.id)}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
          >
            Acknowledge
          </button>
        ) : null}
        {incident.status !== "resolved" && incident.status !== "escalated" ? (
          <button
            type="button"
            onClick={() => onEscalate(incident.id)}
            className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/40"
          >
            Escalate
          </button>
        ) : null}
        {incident.status !== "resolved" ? (
          <button
            type="button"
            onClick={() => onClose(incident.id)}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        ) : null}
        {campusCode ? (
          <CampusWarRoomLauncher
            campusCode={campusCode}
            incidentId={incident.id}
            incidentType={incident.type}
            openWarRoom={incident.suggestedActions?.openWarRoom}
          />
        ) : null}
        {campusCode ? (
          <a
            href={`/api/campus/incidents/${encodeURIComponent(incident.id)}?campusCode=${encodeURIComponent(campusCode)}&format=pdf`}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            After-action PDF
          </a>
        ) : null}
        <span className="inline-flex items-center gap-1 self-center text-[10px] text-slate-500">
          <MapPin className="h-3 w-3" />
          Zone {incident.zoneCode ?? incident.roomCode}
        </span>
      </footer>
    </article>
  );
}

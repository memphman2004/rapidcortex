"use client";

import { useState, type CSSProperties } from "react";
import type { TransitIncidentCreateBody, TransitStation, TransitVehicle } from "rapid-cortex-shared";
import { T } from "./transit-theme";

export function CreateTransitIncidentModal({
  open,
  vehicles,
  stations,
  onClose,
  onSubmit,
}: {
  open: boolean;
  vehicles: TransitVehicle[];
  stations: TransitStation[];
  onClose: () => void;
  onSubmit: (body: TransitIncidentCreateBody) => Promise<void>;
}) {
  const [summary, setSummary] = useState("");
  const [type, setType] = useState<TransitIncidentCreateBody["type"]>("medical");
  const [vehicleId, setVehicleId] = useState("");
  const [stationId, setStationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          void onSubmit({
            type,
            summary,
            vehicleId: vehicleId || undefined,
            stationId: stationId || undefined,
          })
            .then(onClose)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Could not create incident");
            })
            .finally(() => setBusy(false));
        }}
        style={{
          width: 420,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 20,
          color: T.textPrimary,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>New incident</h2>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TransitIncidentCreateBody["type"])}
            style={fieldStyle}
          >
            {["medical", "disturbance", "mechanical", "accessibility", "fare", "security", "other"].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
          Summary
          <textarea
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            style={{ ...fieldStyle, minHeight: 72 }}
          />
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
          Vehicle
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} style={fieldStyle}>
            <option value="">None</option>
            {vehicles.map((v) => (
              <option key={v.vehicleId} value={v.vehicleId}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
          Station
          <select value={stationId} onChange={(e) => setStationId(e.target.value)} style={fieldStyle}>
            <option value="">None</option>
            {stations.map((s) => (
              <option key={s.stationId} value={s.stationId}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {error ? <p style={{ color: T.red, fontSize: 12 }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={btnStyle}>
            Cancel
          </button>
          <button type="submit" disabled={busy} style={{ ...btnStyle, background: T.blue, color: "#fff" }}>
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TransitBroadcastModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void onSubmit(message)
            .then(onClose)
            .finally(() => setBusy(false));
        }}
        style={{
          width: 420,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 20,
          color: T.textPrimary,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Broadcast to operators</h2>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ ...fieldStyle, minHeight: 90 }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onClose} style={btnStyle}>
            Cancel
          </button>
          <button type="submit" disabled={busy} style={{ ...btnStyle, background: T.blue, color: "#fff" }}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: T.bg,
  color: T.textPrimary,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: 8,
  fontSize: 13,
};

const btnStyle: CSSProperties = {
  background: T.surfaceAlt,
  color: T.textPrimary,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
};

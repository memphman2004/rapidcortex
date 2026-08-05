"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VenueCamera, VenueCameraUpsertBody } from "rapid-cortex-shared";
import { venueKvsChannelName } from "rapid-cortex-shared";
import {
  createVenueCameraRegistryEntry,
  deleteVenueCameraRegistryEntry,
  discoverVenueOnvifCamera,
  downloadVenueProducerConfig,
  fetchVenueCameraRegistry,
  updateVenueCameraRegistryEntry,
  type CameraApiVertical,
} from "@/lib/venue/venue-camera-api";

const VENDOR_OPTIONS: Array<{ value: VenueCameraUpsertBody["vendor"]; label: string }> = [
  { value: "onvif", label: "ONVIF (auto-discover)" },
  { value: "axis_rtsp", label: "Axis (RTSP)" },
  { value: "hanwha_rtsp", label: "Hanwha (RTSP)" },
  { value: "bosch_rtsp", label: "Bosch (RTSP)" },
  { value: "genetec", label: "Genetec Security Center" },
  { value: "milestone", label: "Milestone XProtect" },
  { value: "avigilon", label: "Avigilon / Motorola" },
  { value: "generic_rtsp", label: "Generic RTSP" },
];

function statusColor(status: VenueCamera["status"]): string {
  if (status === "online") return "var(--rc-green)";
  if (status === "offline") return "var(--rc-red)";
  return "var(--rc-amber)";
}

function emptyForm(agencyId: string): VenueCameraUpsertBody {
  const cameraId = "";
  return {
    cameraId,
    displayName: "",
    vendor: "onvif",
    kvsChannelName: cameraId ? venueKvsChannelName(agencyId, cameraId) : "",
    rtspUrl: "",
    cameraIp: "",
    sections: [""],
    priorityRank: 1,
    ptzCapable: false,
    floor: undefined,
  };
}

export function VenueCamerasSettingsClient({
  agencyId,
  apiVertical = "venue",
}: {
  agencyId: string;
  apiVertical?: CameraApiVertical;
}) {
  const isCampus = apiVertical === "campus";
  const locationLabel = isCampus ? "Building" : "Sections";
  const [cameras, setCameras] = useState<VenueCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VenueCameraUpsertBody>(() => emptyForm(agencyId));
  const [saving, setSaving] = useState(false);
  const [discoverIp, setDiscoverIp] = useState("");
  const [discoverUser, setDiscoverUser] = useState("");
  const [discoverPass, setDiscoverPass] = useState("");
  const [discovering, setDiscovering] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCameras(await fetchVenueCameraRegistry(agencyId, apiVertical));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cameras");
    } finally {
      setLoading(false);
    }
  }, [agencyId, apiVertical]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const suggestedKvs = useMemo(() => {
    const id = form.cameraId?.trim();
    if (!id) return "";
    return venueKvsChannelName(agencyId, id);
  }, [agencyId, form.cameraId]);

  const startCreate = () => {
    setEditingId("new");
    setForm(emptyForm(agencyId));
  };

  const startEdit = (camera: VenueCamera) => {
    setEditingId(camera.cameraId);
    setForm({
      cameraId: camera.cameraId,
      displayName: camera.displayName,
      vendor: camera.vendor,
      kvsChannelName: camera.kvsChannelName,
      rtspUrl: camera.rtspUrl,
      cameraIp: camera.cameraIp,
      sections: camera.sections,
      priorityRank: camera.priorityRank,
      ptzCapable: camera.ptzCapable,
      status: camera.status,
      buildingId: camera.buildingId,
      floor: camera.floor,
    });
  };

  const runDiscover = async () => {
    if (!discoverIp.trim()) return;
    setDiscovering(true);
    setError(null);
    try {
      const result = await discoverVenueOnvifCamera(agencyId, {
        ip: discoverIp.trim(),
        username: discoverUser.trim() || undefined,
        password: discoverPass || undefined,
      }, apiVertical);
      setEditingId("new");
      setForm({
        cameraId: result.suggestedCameraId,
        displayName: result.discovered.displayName,
        vendor: "onvif",
        kvsChannelName: result.suggestedKvsChannelName,
        rtspUrl: result.discovered.rtspUrl,
        cameraIp: result.discovered.cameraIp,
        sections: form.sections.length ? form.sections : [""],
        priorityRank: 1,
        ptzCapable: result.discovered.ptzCapable,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ONVIF discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: VenueCameraUpsertBody = {
        ...form,
        sections: form.sections.map((s) => s.trim()).filter(Boolean),
        kvsChannelName: form.kvsChannelName?.trim() || suggestedKvs || undefined,
      };
      if (!payload.cameraId?.trim() && editingId === "new") {
        throw new Error("Camera ID is required");
      }
      if (payload.sections.length === 0) {
        throw new Error(isCampus ? "Building code is required" : "At least one section is required");
      }
      if (!payload.rtspUrl?.trim()) {
        throw new Error("RTSP URL is required — use ONVIF discovery or paste from your VMS");
      }
      if (isCampus) {
        payload.buildingId = payload.sections[0];
        const floor = form.floor?.trim();
        payload.floor = floor || undefined;
      }
      if (editingId === "new") {
        await createVenueCameraRegistryEntry(agencyId, payload, apiVertical);
      } else if (editingId) {
        await updateVenueCameraRegistryEntry(agencyId, editingId, payload, apiVertical);
      }
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cameraId: string) => {
    if (!window.confirm("Delete this camera from the registry?")) return;
    await deleteVenueCameraRegistryEntry(agencyId, cameraId, apiVertical);
    await refresh();
  };

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--rc-text-primary)" }}>Camera Registry</h2>
          <p style={{ fontSize: 12, color: "var(--rc-text-muted)", margin: "4px 0 0", maxWidth: 560 }}>
            Universal RTSP → KVS path. Connect Genetec, Milestone, Axis, Hanwha, or any ONVIF camera.
            Download the producer config for your on-site KVS agent after saving cameras.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              void downloadVenueProducerConfig(agencyId, apiVertical).catch((err) => {
                setError(err instanceof Error ? err.message : "Producer config download failed");
              });
            }}
            style={ghostBtn}
          >
            Download KVS producer config
          </button>
          <button type="button" onClick={startCreate} style={primaryBtn}>
            + Add camera
          </button>
        </div>
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          background: "var(--rc-surface-alt)",
          border: "1px solid var(--rc-border)",
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rc-text-secondary)", marginBottom: 8 }}>
          ONVIF DISCOVERY
        </div>
        <p style={{ fontSize: 11, color: "var(--rc-text-muted)", margin: "0 0 10px" }}>
          Enter a camera IP — RC discovers the RTSP URL automatically (no digging through your VMS).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
          <input
            placeholder="Camera IP (e.g. 10.10.1.101)"
            value={discoverIp}
            onChange={(e) => setDiscoverIp(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Username (optional)"
            value={discoverUser}
            onChange={(e) => setDiscoverUser(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Password (optional)"
            type="password"
            value={discoverPass}
            onChange={(e) => setDiscoverPass(e.target.value)}
            style={inputStyle}
          />
          <button type="button" disabled={discovering} onClick={() => void runDiscover()} style={primaryBtn}>
            {discovering ? "Discovering…" : "Discover"}
          </button>
        </div>
      </div>

      {error ? <p style={{ color: "var(--rc-amber)", fontSize: 12 }}>{error}</p> : null}
      {loading ? <p style={{ color: "var(--rc-text-secondary)", fontSize: 12 }}>Loading cameras…</p> : null}

      {!loading && cameras.length === 0 ? (
        <p style={{ color: "var(--rc-text-secondary)", fontSize: 12 }}>No cameras registered yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cameras.map((cam) => (
            <div
              key={cam.cameraId}
              style={{
                background: "var(--rc-surface)",
                border: `1px solid ${cam.status === "offline" ? "var(--rc-red-deep)" : "var(--rc-border)"}`,
                borderRadius: 8,
                padding: "10px 12px",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: statusColor(cam.status),
                    }}
                  />
                  <div style={{ fontWeight: 700, color: "var(--rc-text-primary)", fontSize: 13 }}>{cam.displayName}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--rc-text-secondary)", marginTop: 4 }}>
                  {locationLabel}: {isCampus ? (cam.buildingId ?? cam.sections[0] ?? "—") : cam.sections.join(", ")}
                  {isCampus && cam.floor ? ` · Floor ${cam.floor}` : ""} · Rank {cam.priorityRank} · {cam.vendor}
                </div>
                <div style={{ fontSize: 10, color: "var(--rc-text-muted)", marginTop: 2 }}>
                  KVS: {cam.kvsChannelName}
                  {cam.rtspUrl ? ` · RTSP configured` : " · No RTSP URL"}
                  {cam.lastHeartbeat ? ` · Last heartbeat ${new Date(cam.lastHeartbeat).toLocaleString()}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "start" }}>
                <button type="button" onClick={() => startEdit(cam)} style={ghostBtn}>
                  Edit
                </button>
                <button type="button" onClick={() => void remove(cam.cameraId)} style={ghostBtn}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid var(--rc-border)",
            borderRadius: 8,
            background: "var(--rc-surface-alt)",
          }}
        >
          <h3 style={{ fontSize: 14, color: "var(--rc-text-primary)", margin: "0 0 10px" }}>
            {editingId === "new" ? "New camera" : "Edit camera"}
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            <Field label="Camera ID" value={form.cameraId ?? ""} onChange={(v) => setForm({ ...form, cameraId: v })} />
            <Field label="Display name" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Vendor</span>
              <select
                value={form.vendor}
                onChange={(e) =>
                  setForm({ ...form, vendor: e.target.value as VenueCameraUpsertBody["vendor"] })
                }
                style={inputStyle}
              >
                {VENDOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="RTSP URL"
              value={form.rtspUrl ?? ""}
              onChange={(v) => setForm({ ...form, rtspUrl: v })}
              hint="From VMS export or ONVIF discovery"
            />
            <Field
              label="KVS channel (auto if blank)"
              value={form.kvsChannelName ?? suggestedKvs}
              onChange={(v) => setForm({ ...form, kvsChannelName: v })}
              hint={`Convention: rc-${agencyId}-{cameraId}`}
            />
            <Field
              label={isCampus ? "Building code" : "Sections (comma-separated)"}
              value={form.sections.join(", ")}
              onChange={(v) =>
                setForm({
                  ...form,
                  sections: v.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
            {isCampus ? (
              <Field
                label="Floor (optional)"
                value={form.floor ?? ""}
                onChange={(v) => setForm({ ...form, floor: v || undefined })}
                hint="Match intake floor when set — leave blank for whole-building cameras"
              />
            ) : null}
            <Field
              label="Priority rank (1 = best view)"
              value={String(form.priorityRank)}
              onChange={(v) => setForm({ ...form, priorityRank: Number(v) || 1 })}
            />
            <Field
              label="Camera IP (optional)"
              value={form.cameraIp ?? ""}
              onChange={(v) => setForm({ ...form, cameraIp: v || undefined })}
            />
            <label style={{ fontSize: 11, color: "var(--rc-text-secondary)", display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.ptzCapable}
                onChange={(e) => setForm({ ...form, ptzCapable: e.target.checked })}
              />
              PTZ capable
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" disabled={saving} onClick={() => void save()} style={primaryBtn}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditingId(null)} style={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {hint ? <span style={{ fontSize: 10, color: "var(--rc-text-muted)", marginLeft: 6 }}>{hint}</span> : null}
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
    </label>
  );
}

const labelStyle = { fontSize: 10, color: "var(--rc-text-secondary)", fontWeight: 600 } as const;
const inputStyle = {
  display: "block",
  width: "100%",
  padding: "8px 10px",
  background: "var(--rc-surface)",
  border: "1px solid var(--rc-border)",
  borderRadius: 6,
  color: "var(--rc-text-primary)",
  fontSize: 12,
} as const;
const ghostBtn = {
  fontSize: 11,
  padding: "6px 10px",
  border: "1px solid var(--rc-border)",
  borderRadius: 6,
  color: "var(--rc-text-secondary)",
  background: "transparent",
} as const;
const primaryBtn = {
  fontSize: 11,
  padding: "6px 12px",
  borderRadius: 6,
  color: "var(--rc-amber-dim)",
  background: "var(--rc-amber)",
  fontWeight: 700,
} as const;

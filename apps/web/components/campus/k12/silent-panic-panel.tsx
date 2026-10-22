"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SILENT_PANIC_DISTRICT_OWNS,
  SILENT_PANIC_PRODUCT_DOES,
  type CampusBuildingSummary,
  type CampusSite,
} from "rapid-cortex-shared";
import {
  createCampusIncident,
  patchCampusIncident,
} from "@/lib/campus/campus-incidents-api";
import type { CampusIncident } from "@/lib/campus/types";
import { C } from "@/lib/theme/rc-theme-tokens";

type SilentPanicPanelProps = {
  campusCode: string;
  actorName: string;
  sites: CampusSite[];
  buildings: CampusBuildingSummary[];
  incidents: CampusIncident[];
  canActivate: boolean;
  canOperate: boolean;
  onChanged: () => void;
};

const fieldStyle = {
  width: "100%",
  background: C.surface,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "7px 8px",
  fontSize: 12.5,
  fontFamily: "inherit",
} as const;

export function SilentPanicPanel({
  campusCode,
  actorName,
  sites,
  buildings,
  incidents,
  canActivate,
  canOperate,
  onChanged,
}: SilentPanicPanelProps) {
  const activeSites = sites.filter((site) => site.active !== false);
  const [siteCode, setSiteCode] = useState("");
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    if (siteCode) return;
    const first = sites.find((site) => site.active !== false);
    if (!first) return;
    setSiteCode(first.code);
    setSchoolName(first.name);
  }, [sites, siteCode]);
  const [buildingName, setBuildingName] = useState("");
  const [drill, setDrill] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const schoolBuildings = useMemo(
    () =>
      buildings.filter(
        (building) => !siteCode || !building.siteCode || building.siteCode === siteCode,
      ),
    [buildings, siteCode],
  );

  const openPanic = incidents.filter(
    (incident) => incident.silentPanic && incident.status !== "resolved",
  );

  async function activate() {
    const school = schoolName.trim();
    const building = buildingName.trim();
    if (!school || !building) {
      setError("Choose the school and the building before activating.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const site = activeSites.find((row) => row.code === siteCode);
      await createCampusIncident({
        campusCode,
        buildingCode: building.slice(0, 50),
        floor: null,
        roomCode: "",
        type: "active_threat",
        source: "manual",
        description: "Silent panic",
        isAnonymous: false,
        siteCode: site?.code,
        siteShortName: site?.shortName,
        silentPanic: {
          mode: drill ? "drill" : "live",
          schoolName: school,
          buildingName: building,
          activatedByName: actorName || "Campus staff",
        },
      });
      setConfirming(false);
      setNotice(
        drill
          ? "Drill recorded. It is on this console as a test."
          : "Silent panic recorded. Security can see the Active Threat on this console.",
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silent panic failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(incidentId: string, status: "responding" | "resolved") {
    setBusy(true);
    setError(null);
    try {
      await patchCampusIncident(campusCode, incidentId, { status });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 12,
        padding: "0 16px",
      }}
    >
      <section
        aria-label="Silent panic"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "14px 15px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: C.textSub }}>
              SILENT PANIC
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>
              No siren. No public announcement. Does not call 911.
            </p>
          </div>
        </div>

        {canActivate ? (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {activeSites.length > 0 ? (
              <label style={{ fontSize: 11, color: C.textSub }}>
                School
                <select
                  value={siteCode}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSiteCode(next);
                    const site = activeSites.find((row) => row.code === next);
                    setSchoolName(site?.name ?? "");
                    setBuildingName("");
                  }}
                  style={{ ...fieldStyle, marginTop: 4 }}
                >
                  {activeSites.map((site) => (
                    <option key={site.code} value={site.code}>
                      {site.shortName ? `${site.shortName} — ${site.name}` : site.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label style={{ fontSize: 11, color: C.textSub }}>
                School
                <input
                  value={schoolName}
                  onChange={(event) => setSchoolName(event.target.value)}
                  style={{ ...fieldStyle, marginTop: 4 }}
                  maxLength={160}
                />
              </label>
            )}

            <label style={{ fontSize: 11, color: C.textSub }}>
              Building
              {schoolBuildings.length > 0 ? (
                <select
                  value={buildingName}
                  onChange={(event) => setBuildingName(event.target.value)}
                  style={{ ...fieldStyle, marginTop: 4 }}
                >
                  <option value="">Select a building</option>
                  {schoolBuildings.map((building) => (
                    <option key={building.buildingId} value={building.buildingName}>
                      {building.buildingName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={buildingName}
                  onChange={(event) => setBuildingName(event.target.value)}
                  placeholder="Building name"
                  style={{ ...fieldStyle, marginTop: 4 }}
                  maxLength={160}
                />
              )}
            </label>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: C.text }}>
              <input
                type="checkbox"
                checked={drill}
                onChange={(event) => {
                  setDrill(event.target.checked);
                  setConfirming(false);
                }}
                style={{ marginTop: 2 }}
              />
              <span>
                Drill mode. Marks this as a test. It stays on the campus console and is not a live
                law-enforcement page.
              </span>
            </label>

            {confirming ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void activate()}
                  style={buttonStyle(drill ? C.amber : C.red)}
                >
                  {busy ? "Sending…" : drill ? "Confirm drill" : "Confirm silent panic"}
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirming(false)} style={buttonStyle(C.textMuted)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!schoolName.trim() || !buildingName.trim()) {
                    setError("Choose the school and the building before activating.");
                    return;
                  }
                  setError(null);
                  setConfirming(true);
                }}
                style={buttonStyle(drill ? C.amber : C.red)}
              >
                {drill ? "Start silent drill" : "Activate silent panic"}
              </button>
            )}
          </div>
        ) : (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: C.textMuted }}>
            Campus admin, security, and dispatch can activate silent panic from this console.
          </p>
        )}

        {error ? (
          <p role="alert" style={{ margin: "10px 0 0", fontSize: 12, color: C.red }}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: C.green }}>{notice}</p>
        ) : null}

        {openPanic.length > 0 ? (
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {openPanic.map((incident) => (
              <li
                key={incident.id}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "rgba(239,68,68,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>
                    Active Threat
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.4px",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          incident.silentPanic?.mode === "drill"
                            ? "rgba(245,158,11,0.18)"
                            : "rgba(239,68,68,0.18)",
                        color: incident.silentPanic?.mode === "drill" ? C.amber : "#fca5a5",
                      }}
                    >
                      {incident.silentPanic?.mode === "drill" ? "DRILL" : "SILENT"}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{incident.status}</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
                  {incident.silentPanic?.schoolName} · {incident.silentPanic?.buildingName} ·{" "}
                  {incident.silentPanic?.activatedByName}
                </div>
                {canOperate ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {incident.status === "open" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(incident.id, "responding")}
                        style={buttonStyle(C.blue)}
                      >
                        Acknowledge
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(incident.id, "resolved")}
                      style={buttonStyle(C.textMuted)}
                    >
                      Close
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-label="Silent panic readiness"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "14px 15px",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: C.textSub }}>
          READINESS
        </div>
        <p style={{ margin: "6px 0 8px", fontSize: 12, color: C.text, fontWeight: 600 }}>
          What this product does
        </p>
        <ul style={{ margin: 0, paddingLeft: 16, color: C.textMuted, fontSize: 12, lineHeight: 1.45 }}>
          {SILENT_PANIC_PRODUCT_DOES.map((line) => (
            <li key={line} style={{ marginBottom: 4 }}>
              {line}
            </li>
          ))}
        </ul>
        <p style={{ margin: "10px 0 8px", fontSize: 12, color: C.text, fontWeight: 600 }}>
          What the district still has to finish
        </p>
        <ul style={{ margin: 0, paddingLeft: 16, color: C.textMuted, fontSize: 12, lineHeight: 1.45 }}>
          {SILENT_PANIC_DISTRICT_OWNS.map((line) => (
            <li key={line} style={{ marginBottom: 4 }}>
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function buttonStyle(color: string) {
  return {
    background: "transparent",
    color,
    border: `1px solid ${color}`,
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  } as const;
}

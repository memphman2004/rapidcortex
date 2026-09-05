"use client";

import { useCallback, useEffect, useState } from "react";
import type { CampusAutomationRule, CampusEap, CampusEapUpsertBody } from "rapid-cortex-shared";

const INCIDENT_TYPES = [
  "medical",
  "security",
  "mental_health",
  "suspicious_activity",
  "wellness_check",
  "property_crime",
  "maintenance",
  "active_threat",
  "other",
] as const;

export function CampusEapLibraryClient({ campusCode }: { campusCode: string }) {
  const code = campusCode.toUpperCase();
  const [eaps, setEaps] = useState<CampusEap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [buildingCode, setBuildingCode] = useState("*");
  const [steps, setSteps] = useState("1. Account for occupants\n2. Notify campus safety\n3. Hold until all-clear");
  const [incidentType, setIncidentType] = useState<(typeof INCIDENT_TYPES)[number]>("medical");
  const [rules, setRules] = useState<CampusAutomationRule[]>([]);
  const [ruleName, setRuleName] = useState("Counseling queue + EAP");
  const [ruleType, setRuleType] = useState<(typeof INCIDENT_TYPES)[number]>("mental_health");
  const [ruleZone, setRuleZone] = useState("");
  const [assignCounselor, setAssignCounselor] = useState(true);
  const [attachEap, setAttachEap] = useState(true);
  const [openWarRoom, setOpenWarRoom] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [eapRes, rulesRes] = await Promise.all([
        fetch(`/api/campus/eap?campusCode=${encodeURIComponent(code)}`),
        fetch(`/api/campus/automation-rules?campusCode=${encodeURIComponent(code)}`),
      ]);
      const data = (await eapRes.json()) as { eaps?: CampusEap[]; error?: string };
      if (!eapRes.ok) throw new Error(data.error || `Failed (${eapRes.status})`);
      setEaps(data.eaps ?? []);
      if (rulesRes.ok) {
        const rulesData = (await rulesRes.json()) as { rules?: CampusAutomationRule[] };
        setRules(rulesData.rules ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load EAP library");
    } finally {
      setBusy(false);
    }
  }, [code]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    const stepList = steps
      .split("\n")
      .map((s) => s.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);
    const body: CampusEapUpsertBody = {
      campusCode: code,
      title: title.trim(),
      buildingCode: buildingCode.trim() || "*",
      incidentTypes: [incidentType],
      steps: stepList,
      active: true,
    };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campus/eap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  };

  const saveRule = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        campusCode: code,
        rules: [
          ...rules.map((rule) => ({
            ruleId: rule.ruleId,
            name: rule.name,
            active: rule.active,
            match: rule.match,
            actions: rule.actions,
          })),
          {
            name: ruleName.trim(),
            active: true,
            match: {
              incidentTypes: [ruleType],
              ...(ruleZone.trim() ? { zoneCode: ruleZone.trim() } : {}),
            },
            actions: {
              ...(assignCounselor ? { assignRole: "campus_counselor" } : {}),
              attachEap,
              openWarRoom,
            },
          },
        ],
      };
      const res = await fetch("/api/campus/automation-rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { rules?: CampusAutomationRule[]; error?: string };
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      setRules(data.rules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rule save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Building emergency action plans and incident checklists keyed to building + type. Matched packs
        auto-surface on campus intake. This is not a 911 protocol overlay.
      </p>
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Add EAP / checklist</div>
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          placeholder="Title (e.g. Ballantine medical EAP)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Building code or *"
            value={buildingCode}
            onChange={(e) => setBuildingCode(e.target.value)}
          />
          <select
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value as (typeof INCIDENT_TYPES)[number])}
          >
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => void save()}
          className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save checklist"}
        </button>
      </div>
      <div className="space-y-3">
        {eaps.length === 0 && !busy ? (
          <p className="text-sm text-slate-500">No campus EAP packs yet.</p>
        ) : (
          eaps.map((eap) => (
            <div key={eap.eapId} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-4">
              <div className="text-sm font-semibold text-white">{eap.title}</div>
              <div className="mt-1 text-xs text-slate-400">
                Building {eap.buildingCode} · {eap.incidentTypes.join(", ")} · {eap.active ? "active" : "inactive"}
              </div>
              <ol className="mt-2 list-decimal pl-5 text-sm text-slate-300">
                {eap.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Simple automation (SOC-043)
        </div>
        <p className="text-xs text-slate-500">
          Match type / zone / severity → assign a campus role, attach the EAP checklist, and optionally
          open an in-platform war room. Lockdown and CAD write-back stay fail-closed.
        </p>
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
          placeholder="Rule name"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as (typeof INCIDENT_TYPES)[number])}
          >
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Zone code (optional)"
            value={ruleZone}
            onChange={(e) => setRuleZone(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={assignCounselor} onChange={(e) => setAssignCounselor(e.target.checked)} />
          Assign campus_counselor
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={attachEap} onChange={(e) => setAttachEap(e.target.checked)} />
          Attach matching EAP
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={openWarRoom} onChange={(e) => setOpenWarRoom(e.target.checked)} />
          Suggest / open war room
        </label>
        <button
          type="button"
          disabled={busy || !ruleName.trim()}
          onClick={() => void saveRule()}
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save automation rule
        </button>
        {rules.length > 0 ? (
          <ul className="space-y-1 text-xs text-slate-400">
            {rules.map((rule) => (
              <li key={rule.ruleId}>
                {rule.name} · {rule.match.incidentTypes?.join(", ") || "any type"}
                {rule.actions.assignRole ? ` → ${rule.actions.assignRole}` : ""}
                {rule.actions.openWarRoom ? " · war room" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

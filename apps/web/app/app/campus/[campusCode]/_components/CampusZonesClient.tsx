"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CAMPUS_SITE_SCOPE_ALL,
  getZoneDefaults,
  matchesCampusSiteScope,
  type CampusZoneSummary,
} from "rapid-cortex-shared";
import { campusRoleFamily } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import {
  createCampusZone,
  deleteCampusZone,
  fetchCampusZones,
  updateCampusZone,
} from "@/lib/campus/campus-dashboard-api";
import { CampusSiteSwitcher } from "@/components/campus/campus-site-switcher";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";

function canManageCampusZones(role: string | undefined): boolean {
  if (isRcInternalOperator(role ?? "")) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor";
}

export function CampusZonesClient({
  campusCode,
  agencyId,
  userRole,
}: {
  campusCode: string;
  agencyId: string;
  userRole?: string;
}) {
  const [zones, setZones] = useState<CampusZoneSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSiteCode, setNewSiteCode] = useState("");
  const { scope, setScope, sites, primarySiteCode } = useCampusSiteScope(agencyId);
  const { institutionType } = useCampusInstitutionType();
  const zoneDefaults = useMemo(() => getZoneDefaults(institutionType), [institutionType]);
  const canManage = canManageCampusZones(userRole);
  const isK12 = institutionType === "k12";

  const schoolSites = useMemo(
    () =>
      sites.filter((site) => {
        if (site.active === false) return false;
        if (!isK12) return true;
        // Prefer real schools over the synthetic district primary row.
        return Boolean(site.gradeLevel) || site.code !== primarySiteCode;
      }),
    [sites, isK12, primarySiteCode],
  );

  const visible = useMemo(
    () =>
      zones.filter((zone) =>
        matchesCampusSiteScope(zone.siteCode, scope, primarySiteCode || campusCode),
      ),
    [zones, campusCode, primarySiteCode, scope],
  );

  const schoolNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sites) {
      map.set(site.code.toUpperCase(), site.shortName || site.name);
    }
    return map;
  }, [sites]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setZones(await fetchCampusZones(agencyId));
    } catch (err) {
      setZones([]);
      setError(err instanceof Error ? err.message : "Failed to load zones");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (scope && scope !== CAMPUS_SITE_SCOPE_ALL) {
      setNewSiteCode(scope);
      return;
    }
    if (!newSiteCode && schoolSites[0]?.code) {
      setNewSiteCode(schoolSites[0].code);
    }
  }, [scope, schoolSites, newSiteCode]);

  const startEdit = (zone: CampusZoneSummary) => {
    setEditingId(zone.zoneId);
    setEditLabel(zone.zoneName);
    setAdding(false);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
  };

  const saveEdit = async (zoneId: string) => {
    const label = editLabel.trim();
    if (!label) {
      setError("Zone name is required");
      return;
    }
    setBusyId(zoneId);
    setError(null);
    try {
      const updated = await updateCampusZone(agencyId, zoneId, { label });
      setZones((prev) => prev.map((z) => (z.zoneId === zoneId ? { ...z, ...updated } : z)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename zone");
    } finally {
      setBusyId(null);
    }
  };

  const removeZone = async (zone: CampusZoneSummary) => {
    if (!window.confirm(`Remove zone “${zone.zoneName}”? This cannot be undone.`)) return;
    setBusyId(zone.zoneId);
    setError(null);
    try {
      await deleteCampusZone(agencyId, zone.zoneId);
      setZones((prev) => prev.filter((z) => z.zoneId !== zone.zoneId));
      if (editingId === zone.zoneId) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove zone");
    } finally {
      setBusyId(null);
    }
  };

  const addZone = async () => {
    const label = newLabel.trim();
    const siteCode = newSiteCode.trim();
    if (!label) {
      setError("Zone name is required");
      return;
    }
    if (!siteCode) {
      setError(isK12 ? "Select a school for this zone" : "Select a campus for this zone");
      return;
    }
    setBusyId("__create__");
    setError(null);
    try {
      const created = await createCampusZone(agencyId, { label, siteCode });
      setZones((prev) => [...prev, created]);
      setNewLabel("");
      setAdding(false);
      if (scope === CAMPUS_SITE_SCOPE_ALL) {
        setScope(siteCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add zone");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Zones</h2>
          <p className="mt-1 text-sm text-slate-400">
            {isK12
              ? "Select a school to see and manage that school’s zones."
              : `Campus zones for ${campusCode} — live incident and responder counts.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CampusSiteSwitcher sites={sites} value={scope} onChange={setScope} />
          {canManage ? (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setEditingId(null);
                setError(null);
              }}
              className="rounded-md border border-sky-700/60 bg-sky-950/40 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-900/50"
            >
              Add zone
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading zones…</p> : null}

      {canManage && adding ? (
        <div className="rounded-lg border border-sky-800/50 bg-slate-950/70 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300/90">New zone</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Zone name
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. North Gymnasium"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                maxLength={120}
              />
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {isK12 ? "School" : "Campus"}
              <select
                value={newSiteCode}
                onChange={(e) => setNewSiteCode(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
              >
                {(schoolSites.length > 0 ? schoolSites : sites).map((site) => (
                  <option key={site.code} value={site.code}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyId === "__create__"}
              onClick={() => void addZone()}
              className="rounded-md border border-sky-600 bg-sky-700/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {busyId === "__create__" ? "Saving…" : "Save zone"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewLabel("");
              }}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
          <div className="pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Suggested names
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {zoneDefaults.map((label) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => setNewLabel(label)}
                    className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {!loading && sites.length > 1 ? (
        <p className="text-xs text-slate-500">
          Showing {visible.length} zone{visible.length === 1 ? "" : "s"}
          {scope === CAMPUS_SITE_SCOPE_ALL ? ` across ${sites.length} schools` : null}
        </p>
      ) : null}

      {!loading && visible.length === 0 && !adding ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            {isK12
              ? "No zones are published for this school yet."
              : "No zones are published for this campus yet."}
          </p>
          {canManage ? (
            <p className="text-xs text-slate-500">Use Add zone to create the first one.</p>
          ) : (
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Suggested {isK12 ? "school" : "campus"} zones
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {zoneDefaults.map((label) => (
                  <li
                    key={label}
                    className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((zone) => {
          const schoolLabel = zone.siteCode
            ? schoolNameByCode.get(zone.siteCode.toUpperCase())
            : undefined;
          const isEditing = editingId === zone.zoneId;
          return (
            <li
              key={zone.zoneId}
              className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                {isEditing ? (
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                    maxLength={120}
                    autoFocus
                  />
                ) : (
                  <p className="text-sm font-semibold text-white">{zone.zoneName}</p>
                )}
                {isK12 && schoolLabel && !isEditing ? (
                  <span className="shrink-0 rounded bg-violet-950/80 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                    {schoolLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{zone.status}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <dt className="text-slate-500">Incidents</dt>
                  <dd className="font-mono text-slate-100">{zone.incidentCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Responders</dt>
                  <dd className="font-mono text-slate-100">{zone.responderCount}</dd>
                </div>
              </dl>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === zone.zoneId}
                        onClick={() => void saveEdit(zone.zoneId)}
                        className="rounded border border-sky-700/70 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-950/50 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busyId === zone.zoneId}
                        onClick={() => startEdit(zone)}
                        className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={busyId === zone.zoneId}
                        onClick={() => void removeZone(zone)}
                        className="rounded border border-rose-900/60 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  SALES_TERRITORY_ZONES,
  emptySalesTerritoryAssignments,
  normalizeSalesTerritoryAssignments,
  type SalesTerritoryAssignee,
  type SalesTerritoryAssignmentsConfig,
  type SalesTerritoryZoneId,
} from "rapid-cortex-shared";
import { fetchAdminUsers, type AdminUserRow } from "@/lib/api";
import { SALES_CONTRACTOR_ROLE } from "@/lib/sales/sales-authz";

const ASSIGN_QK = ["rc-sales-territories"] as const;
const USERS_QK = ["rc-sales-contractors"] as const;
const API = "/api/rc-admin/settings/sales-territories";

async function fetchAssignments(): Promise<SalesTerritoryAssignmentsConfig> {
  const r = await fetch(API, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load territory assignments");
  const data = (await r.json()) as { assignments?: SalesTerritoryAssignmentsConfig };
  return normalizeSalesTerritoryAssignments(
    data.assignments ?? emptySalesTerritoryAssignments(),
  );
}

async function saveAssignments(
  cfg: SalesTerritoryAssignmentsConfig,
): Promise<SalesTerritoryAssignmentsConfig> {
  const r = await fetch(API, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cfg),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to save");
  }
  const data = (await r.json()) as { assignments?: SalesTerritoryAssignmentsConfig };
  return normalizeSalesTerritoryAssignments(
    data.assignments ?? emptySalesTerritoryAssignments(),
  );
}

function contractorLabel(u: AdminUserRow): string {
  const name = (u.email || u.username).split("@")[0]?.replace(/[._]/g, " ") ?? u.username;
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function toAssignee(u: AdminUserRow): SalesTerritoryAssignee {
  return {
    userId: u.username || u.email,
    email: u.email || u.username,
    name: contractorLabel(u),
  };
}

export function SalesTerritoriesSettings() {
  const qc = useQueryClient();
  const assignQ = useQuery({ queryKey: ASSIGN_QK, queryFn: fetchAssignments });
  const usersQ = useQuery({
    queryKey: USERS_QK,
    queryFn: fetchAdminUsers,
    staleTime: 60_000,
  });

  const [draft, setDraft] = useState<SalesTerritoryAssignmentsConfig>(
    emptySalesTerritoryAssignments(),
  );
  const [pickByZone, setPickByZone] = useState<Partial<Record<SalesTerritoryZoneId, string>>>(
    {},
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (assignQ.data) setDraft(assignQ.data);
  }, [assignQ.data]);

  const contractors = useMemo(() => {
    const rows = usersQ.data ?? [];
    return rows.filter(
      (u) =>
        String(u.role ?? "").toLowerCase() === SALES_CONTRACTOR_ROLE && u.enabled !== false,
    );
  }, [usersQ.data]);

  const saveM = useMutation({
    mutationFn: saveAssignments,
    onSuccess: (savedCfg) => {
      setDraft(savedCfg);
      void qc.invalidateQueries({ queryKey: ASSIGN_QK });
      void qc.invalidateQueries({ queryKey: ["sales-territories"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function assigneesFor(zoneId: SalesTerritoryZoneId): SalesTerritoryAssignee[] {
    return draft.zones.find((z) => z.zoneId === zoneId)?.assignees ?? [];
  }

  function setAssignees(zoneId: SalesTerritoryZoneId, assignees: SalesTerritoryAssignee[]) {
    setDraft((prev) =>
      normalizeSalesTerritoryAssignments({
        ...prev,
        zones: prev.zones.map((z) => (z.zoneId === zoneId ? { ...z, assignees } : z)),
      }),
    );
  }

  function addSelected(zoneId: SalesTerritoryZoneId) {
    const key = pickByZone[zoneId];
    if (!key) return;
    const user = contractors.find((u) => (u.username || u.email) === key);
    if (!user) return;
    const next = toAssignee(user);
    const existing = assigneesFor(zoneId);
    if (existing.some((a) => a.email.toLowerCase() === next.email.toLowerCase())) return;
    setAssignees(zoneId, [...existing, next]);
    setPickByZone((p) => ({ ...p, [zoneId]: "" }));
  }

  function removeAssignee(zoneId: SalesTerritoryZoneId, email: string) {
    setAssignees(
      zoneId,
      assigneesFor(zoneId).filter((a) => a.email.toLowerCase() !== email.toLowerCase()),
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold text-white">Sales territories</h2>
        <p className="mt-1 text-sm text-slate-400">
          Assign one or more sales contractors to each hiring-doc zone. Changes appear on the Sales
          Portal Team Regions tab within a few seconds.
        </p>
      </div>

      {(usersQ.isError || assignQ.isError) && (
        <p className="text-sm text-rose-400">
          {usersQ.isError
            ? "Could not load sales contractors from Cognito."
            : "Could not load territory assignments."}
        </p>
      )}

      <div className="space-y-4">
        {SALES_TERRITORY_ZONES.map((zone) => {
          const assignees = assigneesFor(zone.id);
          const assignedEmails = new Set(assignees.map((a) => a.email.toLowerCase()));
          const available = contractors.filter(
            (u) => !assignedEmails.has((u.email || u.username).toLowerCase()),
          );
          return (
            <div
              key={zone.id}
              className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{zone.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{zone.primaryFocus}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{zone.states.join(", ")}</p>
                </div>
                <div className="text-right text-[11px] text-slate-500">{zone.deskEmail}</div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Currently assigned
                </div>
                {assignees.length === 0 ? (
                  <p className="text-xs text-slate-500">No contractors assigned yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {assignees.map((a) => (
                      <li
                        key={a.email}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <span>
                          <span className="font-medium text-white">{a.name}</span>
                          <span className="ml-1.5 text-slate-500">{a.email}</span>
                        </span>
                        <button
                          type="button"
                          className="text-slate-500 hover:text-rose-400"
                          onClick={() => removeAssignee(zone.id, a.email)}
                          aria-label={`Remove ${a.name}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <select
                  className="min-w-[240px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={pickByZone[zone.id] ?? ""}
                  onChange={(e) =>
                    setPickByZone((p) => ({ ...p, [zone.id]: e.target.value }))
                  }
                  disabled={usersQ.isLoading || available.length === 0}
                >
                  <option value="">
                    {usersQ.isLoading
                      ? "Loading contractors…"
                      : available.length === 0
                        ? contractors.length === 0
                          ? "No sales contractors found"
                          : "All contractors already assigned"
                        : "Add sales contractor…"}
                  </option>
                  {available.map((u) => (
                    <option key={u.username || u.email} value={u.username || u.email}>
                      {contractorLabel(u)} — {u.email || u.username}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-lg border border-sky-700/50 bg-sky-900/40 px-3 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/60 disabled:opacity-40"
                  disabled={!pickByZone[zone.id]}
                  onClick={() => addSelected(zone.id)}
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          disabled={saveM.isPending || assignQ.isLoading}
          onClick={() => saveM.mutate(draft)}
        >
          {saveM.isPending ? "Saving…" : "Save assignments"}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved — Sales Portal will refresh shortly.</span>}
        {saveM.isError && (
          <span className="text-sm text-rose-400">
            {saveM.error instanceof Error ? saveM.error.message : "Save failed"}
          </span>
        )}
      </div>
    </div>
  );
}

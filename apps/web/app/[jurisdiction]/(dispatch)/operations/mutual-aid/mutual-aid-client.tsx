"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, Radio, X } from "lucide-react";
import type { MutualAidRequest } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };
type Tab = "active" | "mine";
type Filter = "all" | "mine" | "partner";

function timeSince(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const priorityBadge: Record<number, string> = {
  1: "bg-red-900/60 text-red-200",
  2: "bg-orange-900/50 text-orange-200",
  3: "bg-amber-900/50 text-amber-200",
  4: "bg-sky-900/50 text-sky-200",
  5: "bg-slate-700 text-slate-300",
};

export function MutualAidClient({ params }: Props) {
  use(params);
  const { user } = useSession();
  const agencyId = user?.agencyId || "";
  const qc = useQueryClient();
  const enabled = isFeaturesSuiteUiEnabled();

  const [tab, setTab] = useState<Tab>("active");
  const [filter, setFilter] = useState<Filter>("all");
  const [commitFor, setCommitFor] = useState<MutualAidRequest | null>(null);
  const [unitName, setUnitName] = useState("");
  const [unitType, setUnitType] = useState("ALS");
  const [unitId, setUnitId] = useState("");
  const [eta, setEta] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [priority, setPriority] = useState(2);
  const [resourceType, setResourceType] = useState("ALS Unit");
  const [quantity, setQuantity] = useState(1);
  const [lat, setLat] = useState("39.1");
  const [lon, setLon] = useState("-84.5");
  const [locationAddress, setLocationAddress] = useState("");
  const [notes, setNotes] = useState("");

  const listQ = useQuery({
    queryKey: ["mutual-aid", agencyId],
    queryFn: () =>
      featureSuiteFetch<{ requests: MutualAidRequest[]; total: number }>("mutual-aid"),
    enabled,
    refetchInterval: 15_000,
  });

  const requests = listQ.data?.requests ?? [];

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filter === "mine") return r.requestingAgencyId === agencyId;
      if (filter === "partner") return r.requestingAgencyId !== agencyId;
      return true;
    });
  }, [requests, filter, agencyId]);

  const myRequests = useMemo(
    () => requests.filter((r) => r.requestingAgencyId === agencyId),
    [requests, agencyId],
  );

  const commitMut = useMutation({
    mutationFn: (requestId: string) =>
      featureSuiteFetch(`mutual-aid/${encodeURIComponent(requestId)}/commit`, {
        method: "POST",
        body: JSON.stringify({
          committingAgencyName: agencyName || user?.agencyId || "Agency",
          resources: [
            {
              unitId: unitId || `unit-${Date.now()}`,
              unitType,
              unitName: unitName || unitType,
              personnelCount: 1,
            },
          ],
          estimatedArrival: eta ? new Date(eta).toISOString() : undefined,
        }),
      }),
    onSuccess: () => {
      setCommitFor(null);
      void qc.invalidateQueries({ queryKey: ["mutual-aid"] });
    },
  });

  const createMut = useMutation({
    mutationFn: () =>
      featureSuiteFetch("mutual-aid", {
        method: "POST",
        body: JSON.stringify({
          requestingAgencyName: agencyName || user?.agencyId || "Agency",
          incidentType: incidentType || undefined,
          priority,
          resourcesNeeded: [{ resourceType, quantity }],
          location: {
            address: locationAddress || "Scene location",
            lat: Number(lat),
            lon: Number(lon),
          },
          requestNotes: notes || undefined,
        }),
      }),
    onSuccess: () => {
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ["mutual-aid"] });
    },
  });

  const statusMut = useMutation({
    mutationFn: (opts: {
      requestId: string;
      commitmentId: string;
      status: "committed" | "en_route" | "on_scene" | "released" | "cancelled";
    }) =>
      featureSuiteFetch(
        `mutual-aid/${encodeURIComponent(opts.requestId)}/commitments/${encodeURIComponent(opts.commitmentId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            requestId: opts.requestId,
            commitmentId: opts.commitmentId,
            status: opts.status,
          }),
        },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mutual-aid"] }),
  });

  if (!enabled) {
    return <div className="p-6 text-sm text-slate-400">Mutual aid is not enabled.</div>;
  }

  const renderCard = (r: MutualAidRequest) => (
    <article
      key={r.requestId}
      className="rounded-lg border border-slate-800 bg-[#161b2e] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{r.requestingAgencyName}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadge[r.priority] ?? priorityBadge[5]}`}
            >
              P{r.priority}
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
              {r.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            {r.incidentType || "Incident"}
            {r.incidentId ? ` · ${r.incidentId}` : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            {timeSince(r.requestedAt)}
          </p>
        </div>
        {r.status !== "closed" && r.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => {
              setCommitFor(r);
              setAgencyName(user?.agencyId || "");
            }}
            className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
          >
            Commit resources
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-1 text-xs text-slate-400">
        {r.resourcesNeeded.map((n) => (
          <li key={n.needId}>
            {n.quantity}× {n.resourceType} ({n.filledQuantity} filled)
          </li>
        ))}
      </ul>
      {r.resourcesCommitted?.length > 0 && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
            Commitments
          </div>
          {r.resourcesCommitted.map((c) => (
            <div
              key={c.commitmentId}
              className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span>
                {c.committingAgencyName}:{" "}
                {c.resources.map((u) => u.unitName).join(", ")} ·{" "}
                <span className="capitalize text-sky-300">{c.status.replace(/_/g, " ")}</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {(["en_route", "on_scene", "released"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={statusMut.isPending}
                    onClick={() =>
                      statusMut.mutate({
                        requestId: r.requestId,
                        commitmentId: c.commitmentId,
                        status: st,
                      })
                    }
                    className="rounded border border-slate-700 px-1.5 py-0.5 capitalize text-slate-400 hover:text-white"
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );

  return (
    <div className="min-h-full space-y-4 bg-[#0f1117] p-4 md:p-6 text-[#e2e4ea]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Radio className="h-5 w-5 text-sky-400" />
            Mutual Aid Resource Board
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Partner requests and your agency commitments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setAgencyName(user?.agencyId || "");
          }}
          className="inline-flex items-center gap-1.5 rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" />
          New request
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {(
          [
            ["active", "Active requests"],
            ["mine", "My agency requests"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === id
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "active" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["mine", "My agency"],
                ["partner", "Partner"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  filter === id
                    ? "border-sky-600 bg-sky-950/40 text-sky-200"
                    : "border-slate-700 text-slate-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {listQ.isLoading && <p className="text-xs text-slate-500">Loading…</p>}
          {listQ.isError && (
            <p className="text-xs text-red-400">{(listQ.error as Error).message}</p>
          )}
          <div className="grid gap-3">{filtered.map(renderCard)}</div>
          {!listQ.isLoading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No open requests.</p>
          )}
        </>
      )}

      {tab === "mine" && (
        <div className="grid gap-3">
          {myRequests.map(renderCard)}
          {myRequests.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              No requests from your agency yet.
            </p>
          )}
        </div>
      )}

      {commitFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-[#161b2e] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Commit resources</h3>
              <button type="button" onClick={() => setCommitFor(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="Unit ID"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                placeholder="Unit name"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                placeholder="Unit type"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={commitMut.isPending}
                onClick={() => commitMut.mutate(commitFor.requestId)}
                className="w-full rounded bg-sky-700 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                Confirm commitment
              </button>
              {commitMut.isError && (
                <p className="text-xs text-red-400">{(commitMut.error as Error).message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-[#161b2e] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Create mutual aid request</h3>
              <button type="button" onClick={() => setCreateOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="Agency display name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                placeholder="Incident type"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    Priority {p}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  placeholder="Resource type"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                  className="flex-1 rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-20 rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
                />
              </div>
              <input
                placeholder="Location address"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  placeholder="Lat"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="flex-1 rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
                />
                <input
                  placeholder="Lon"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  className="flex-1 rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
                />
              </div>
              <textarea
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={createMut.isPending || !agencyName}
                onClick={() => createMut.mutate()}
                className="w-full rounded bg-sky-700 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                Submit request
              </button>
              {createMut.isError && (
                <p className="text-xs text-red-400">{(createMut.error as Error).message}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, X } from "lucide-react";
import type { CriticalInfrastructure } from "rapid-cortex-shared";
import { InfrastructurePanel } from "@/components/dispatch/InfrastructurePanel";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

const INFRA_TYPES = [
  "school_k12",
  "university",
  "hospital",
  "government",
  "utility_electric",
  "utility_water",
  "utility_gas",
  "stadium",
  "airport",
  "shopping_center",
  "hotel",
  "other",
] as const;

type ListResponse = { infrastructure: CriticalInfrastructure[]; total: number };

export function InfrastructureClient({ params }: Props) {
  use(params);
  const enabled = isFeaturesSuiteUiEnabled();
  const qc = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CriticalInfrastructure | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [infraType, setInfraType] = useState<(typeof INFRA_TYPES)[number]>("school_k12");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [lat, setLat] = useState("39.1");
  const [lon, setLon] = useState("-84.5");

  const [protocolTitle, setProtocolTitle] = useState("");
  const [protocolType, setProtocolType] = useState("active_shooter");
  const [protocolStep, setProtocolStep] = useState("");

  const listQ = useQuery({
    queryKey: ["infra-admin", typeFilter],
    queryFn: () =>
      featureSuiteFetch<ListResponse>(
        typeFilter ? `infra?type=${encodeURIComponent(typeFilter)}` : "infra",
      ),
    enabled,
  });

  const filtered = useMemo(() => {
    const rows = listQ.data?.infrastructure ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((f) => {
      const blob = `${f.name} ${f.address.street} ${f.address.city}`.toLowerCase();
      return blob.includes(q);
    });
  }, [listQ.data, search]);

  const upsertMut = useMutation({
    mutationFn: () => {
      const infraId = `infra-${Date.now()}`;
      return featureSuiteFetch(`infra/${encodeURIComponent(infraId)}`, {
        method: "PUT",
        body: JSON.stringify({
          infraId,
          name,
          infraType,
          address: {
            street,
            city,
            state,
            zip,
            lat: Number(lat),
            lon: Number(lon),
          },
          primaryContact: {
            role: "primary",
            name: contactName || "Contact",
            phone: contactPhone || "000-000-0000",
          },
        }),
      });
    },
    onSuccess: () => {
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ["infra-admin"] });
    },
  });

  const protocolMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No facility selected");
      const protocolId = `proto-${Date.now()}`;
      return featureSuiteFetch(
        `infra/${encodeURIComponent(selected.infraId)}/protocols/${encodeURIComponent(protocolId)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            protocolId,
            incidentType: protocolType,
            title: protocolTitle,
            steps: protocolStep
              ? [{ order: 1, action: protocolStep }]
              : [{ order: 1, action: "Initial actions TBD" }],
            contacts: [],
          }),
        },
      );
    },
    onSuccess: () => {
      setProtocolTitle("");
      setProtocolStep("");
      void qc.invalidateQueries({ queryKey: ["infra-admin"] });
      setSelected(null);
    },
  });

  if (!enabled) {
    return <div className="p-6 text-sm text-slate-400">Infrastructure is not enabled.</div>;
  }

  return (
    <div className="min-h-full space-y-6 bg-[#0f1117] p-4 md:p-6 text-[#e2e4ea]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Building2 className="h-5 w-5 text-violet-400" />
            Critical Infrastructure
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Pre-plans, contacts, and protocols for high-priority facilities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" /> Add facility
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or address…"
            className="w-full rounded border border-slate-700 bg-[#161b2e] py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-slate-700 bg-[#161b2e] px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {INFRA_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {listQ.isLoading && <p className="text-xs text-slate-500">Loading…</p>}
      {listQ.isError && (
        <p className="text-xs text-red-400">{(listQ.error as Error).message}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((f) => (
          <button
            key={f.infraId}
            type="button"
            onClick={() => setSelected(f)}
            className="rounded-lg border border-slate-800 bg-[#161b2e] p-4 text-left hover:border-violet-700/50"
          >
            <div className="font-medium text-white">{f.name}</div>
            <div className="mt-1 text-xs capitalize text-violet-300/80">
              {f.infraType.replace(/_/g, " ")}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {f.address.street}, {f.address.city}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              {f.floorPlans?.length ?? 0} floor plans · {f.protocols?.length ?? 0} protocols
              {f.lastReviewedAt
                ? ` · reviewed ${new Date(f.lastReviewedAt).toLocaleDateString()}`
                : ""}
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && !listQ.isLoading && (
        <p className="py-8 text-center text-sm text-slate-500">No facilities found.</p>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
          <div className="flex h-full w-full max-w-lg flex-col border-l border-slate-700 bg-[#161b2e]">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <h2 className="font-semibold text-white">{selected.name}</h2>
              <button type="button" onClick={() => setSelected(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <InfrastructurePanel facility={selected} />

              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-500">
                  Facility info
                </div>
                <p className="text-sm text-slate-300">
                  {selected.address.street}, {selected.address.city}, {selected.address.state}{" "}
                  {selected.address.zip}
                </p>
                {selected.occupancyLoad != null && (
                  <p className="text-xs text-slate-400">Occupancy: {selected.occupancyLoad}</p>
                )}
                {selected.operatingHours && (
                  <p className="text-xs text-slate-400">Hours: {selected.operatingHours}</p>
                )}
              </div>

              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase text-slate-500">
                  Add protocol
                </div>
                <div className="space-y-2">
                  <input
                    placeholder="Title"
                    value={protocolTitle}
                    onChange={(e) => setProtocolTitle(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Incident type"
                    value={protocolType}
                    onChange={(e) => setProtocolType(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="First step action"
                    value={protocolStep}
                    onChange={(e) => setProtocolStep(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!protocolTitle || protocolMut.isPending}
                    onClick={() => protocolMut.mutate()}
                    className="rounded bg-violet-700 px-3 py-1.5 text-xs text-white hover:bg-violet-600 disabled:opacity-50"
                  >
                    Save protocol
                  </button>
                  {protocolMut.isError && (
                    <p className="text-xs text-red-400">
                      {(protocolMut.error as Error).message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-[#161b2e] p-4">
            <div className="mb-3 flex justify-between">
              <h3 className="font-semibold">Add facility</h3>
              <button type="button" onClick={() => setCreateOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <select
                value={infraType}
                onChange={(e) => setInfraType(e.target.value as typeof infraType)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              >
                {INFRA_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <input
                placeholder="Street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="rounded border border-slate-700 bg-[#0f1117] px-2 py-2 text-sm"
                />
                <input
                  placeholder="ST"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="rounded border border-slate-700 bg-[#0f1117] px-2 py-2 text-sm"
                />
                <input
                  placeholder="ZIP"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="rounded border border-slate-700 bg-[#0f1117] px-2 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Lat"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="flex-1 rounded border border-slate-700 bg-[#0f1117] px-2 py-2 text-sm"
                />
                <input
                  placeholder="Lon"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  className="flex-1 rounded border border-slate-700 bg-[#0f1117] px-2 py-2 text-sm"
                />
              </div>
              <input
                placeholder="Primary contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                placeholder="Primary contact phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!name || !street || upsertMut.isPending}
                onClick={() => upsertMut.mutate()}
                className="w-full rounded bg-sky-700 py-2 text-sm text-white disabled:opacity-50"
              >
                Create
              </button>
              {upsertMut.isError && (
                <p className="text-xs text-red-400">{(upsertMut.error as Error).message}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

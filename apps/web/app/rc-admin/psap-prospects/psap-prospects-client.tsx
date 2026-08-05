"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PSAP_OUTREACH_STATUSES,
  type PsapOutreachStatus,
  type PsapProspect,
  type PsapProspectListQuery,
} from "rapid-cortex-shared";
import { List, Map as MapIcon } from "lucide-react";
import {
  getPsapMapPins,
  getPsapStats,
  listPsapProspects,
  patchPsapProspect,
} from "@/lib/psap/psap-api";
import { PsapDetailPanel } from "./components/PsapDetailPanel";
import { PsapFilterBar } from "./components/PsapFilterBar";
import { PsapMapView } from "./components/PsapMapView";
import { PsapProspectTable } from "./components/PsapProspectTable";
import { PsapStatsStrip } from "./components/PsapStatsStrip";

const VIEW_KEY = "rc-psap-prospects-view";
type ViewMode = "table" | "map";

function parseQuery(params: URLSearchParams): PsapProspectListQuery {
  const status = params.get("status") ?? params.get("outreachStatus");
  const outreachStatus =
    status && (PSAP_OUTREACH_STATUSES as readonly string[]).includes(status)
      ? (status as PsapOutreachStatus)
      : undefined;
  const hasAddressRaw = params.get("hasAddress");
  const page = Number(params.get("page") ?? "1");
  const sortByRaw = params.get("sortBy");
  const sortBy =
    sortByRaw === "psapName" ||
    sortByRaw === "state" ||
    sortByRaw === "outreachStatus" ||
    sortByRaw === "lastContactedAt" ||
    sortByRaw === "updatedAt"
      ? sortByRaw
      : "psapName";
  const sortDir = params.get("sortDir") === "desc" ? "desc" : "asc";

  return {
    state: params.get("state")?.toUpperCase() || undefined,
    outreachStatus,
    search: params.get("search") || undefined,
    hasAddress:
      hasAddressRaw === "true" || hasAddressRaw === "1"
        ? true
        : hasAddressRaw === "false" || hasAddressRaw === "0"
          ? false
          : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: 50,
    sortBy,
    sortDir,
  };
}

function queryToParams(q: PsapProspectListQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.state) p.set("state", q.state);
  if (q.outreachStatus) p.set("status", q.outreachStatus);
  if (q.search) p.set("search", q.search);
  if (q.hasAddress !== undefined) p.set("hasAddress", String(q.hasAddress));
  if (q.page && q.page > 1) p.set("page", String(q.page));
  if (q.sortBy && q.sortBy !== "psapName") p.set("sortBy", q.sortBy);
  if (q.sortDir && q.sortDir !== "asc") p.set("sortDir", q.sortDir);
  return p;
}

export function PsapProspectsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const listQuery = useMemo(() => parseQuery(searchParams), [searchParams]);

  const [view, setView] = useState<ViewMode>("table");
  const [selected, setSelected] = useState<PsapProspect | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === "map" || stored === "table") setView(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setViewMode = (mode: ViewMode) => {
    setView(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const syncQuery = useCallback(
    (next: PsapProspectListQuery) => {
      const qs = queryToParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const statsQuery = useQuery({
    queryKey: ["psap-prospects", "stats"],
    queryFn: getPsapStats,
  });

  const listResult = useQuery({
    queryKey: ["psap-prospects", "list", listQuery],
    queryFn: () => listPsapProspects(listQuery),
    enabled: view === "table",
  });

  const pinsQuery = useQuery({
    queryKey: ["psap-prospects", "map-pins"],
    queryFn: getPsapMapPins,
    enabled: view === "map",
    staleTime: 5 * 60_000,
  });

  const onStatusChange = async (psapId: string, outreachStatus: PsapOutreachStatus) => {
    const updated = await patchPsapProspect(psapId, { outreachStatus });
    if (selected?.psapId === psapId) setSelected(updated);
    await queryClient.invalidateQueries({ queryKey: ["psap-prospects"] });
  };

  const onSort = (sortBy: NonNullable<PsapProspectListQuery["sortBy"]>) => {
    const sortDir =
      listQuery.sortBy === sortBy && listQuery.sortDir === "asc" ? "desc" : "asc";
    syncQuery({ ...listQuery, sortBy, sortDir, page: 1 });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">PSAP Prospects</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            National PSAP outreach database
            {statsQuery.data ? ` — ${statsQuery.data.total.toLocaleString()} dispatch centers` : ""}.
            Track outbound contact status separately from inbound Leads CRM.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-[#1e2130] bg-[#0f1117] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${
              view === "table"
                ? "bg-violet-500/20 text-violet-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${
              view === "map"
                ? "bg-violet-500/20 text-violet-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" /> Map
          </button>
        </div>
      </div>

      <PsapStatsStrip stats={statsQuery.data} isLoading={statsQuery.isLoading} />

      <PsapFilterBar
        query={listQuery}
        total={
          view === "table"
            ? (listResult.data?.total ?? 0)
            : (pinsQuery.data?.length ?? statsQuery.data?.total ?? 0)
        }
        stats={statsQuery.data}
        onChange={syncQuery}
      />

      {view === "table" ? (
        <div className="relative flex gap-0">
          <div className={`min-w-0 flex-1 ${selected ? "lg:pr-0" : ""}`}>
            <PsapProspectTable
              items={listResult.data?.items ?? []}
              total={listResult.data?.total ?? 0}
              page={listResult.data?.page ?? listQuery.page ?? 1}
              pageSize={listResult.data?.pageSize ?? 50}
              hasMore={listResult.data?.hasMore ?? false}
              selectedId={selected?.psapId}
              sortBy={listQuery.sortBy}
              sortDir={listQuery.sortDir}
              isLoading={listResult.isLoading}
              onSelect={setSelected}
              onPageChange={(page) => syncQuery({ ...listQuery, page })}
              onSort={onSort}
              onStatusChange={(id, status) => void onStatusChange(id, status)}
            />
            {listResult.isError && (
              <p className="mt-2 text-sm text-rose-300">
                {listResult.error instanceof Error
                  ? listResult.error.message
                  : "Failed to load prospects"}
              </p>
            )}
          </div>
          {selected && (
            <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md shadow-2xl lg:sticky lg:top-4 lg:z-10 lg:h-[calc(100vh-6rem)] lg:max-h-[860px]">
              <PsapDetailPanel
                prospect={selected}
                onClose={() => setSelected(null)}
                onUpdated={(p) => {
                  setSelected(p);
                  void queryClient.invalidateQueries({ queryKey: ["psap-prospects"] });
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex gap-0">
          <div className="min-w-0 flex-1">
            <PsapMapView
              pins={pinsQuery.data ?? []}
              statusFilter={listQuery.outreachStatus}
              isLoading={pinsQuery.isLoading}
              onSelectProspect={setSelected}
            />
            {pinsQuery.isError && (
              <p className="mt-2 text-sm text-rose-300">
                {pinsQuery.error instanceof Error
                  ? pinsQuery.error.message
                  : "Failed to load map pins"}
              </p>
            )}
          </div>
          {selected && (
            <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md shadow-2xl lg:sticky lg:top-4 lg:z-10 lg:h-[calc(100vh-6rem)] lg:max-h-[860px]">
              <PsapDetailPanel
                prospect={selected}
                onClose={() => setSelected(null)}
                onUpdated={(p) => {
                  setSelected(p);
                  void queryClient.invalidateQueries({ queryKey: ["psap-prospects"] });
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

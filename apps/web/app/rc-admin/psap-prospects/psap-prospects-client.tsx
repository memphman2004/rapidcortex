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
import { List, Map as MapIcon, Sparkles } from "lucide-react";
import { SafetySourceLookupLink } from "@/components/psap/safety-source-lookup-link";
import {
  enrichAllPsapContacts,
  getPsapMapPins,
  getPsapStats,
  listPsapProspects,
  patchPsapProspect,
} from "@/lib/psap/psap-api";
import { patchOutreachProspectLocal } from "@/lib/psap/outreach-crm-store";
import {
  buildOutreachCsv,
  computeOutreachStats,
  listOutreachAsPsapProspects,
  OUTREACH_LISTS,
  OUTREACH_PROSPECT_COUNTS,
  type ProspectTableRow,
  type ProspectVerticalFilter,
  verticalFilterLabel,
} from "@/lib/psap/outreach-prospects";
import { PsapDetailPanel } from "./components/PsapDetailPanel";
import { PsapFilterBar } from "./components/PsapFilterBar";
import { PsapMapView } from "./components/PsapMapView";
import { PsapProspectTable } from "./components/PsapProspectTable";
import { PsapStatsStrip } from "./components/PsapStatsStrip";

const VIEW_KEY = "rc-psap-prospects-view";
type ViewMode = "table" | "map";

const VERTICAL_OPTIONS: ProspectVerticalFilter[] = ["psap", "campus", "venue", "transit", "all"];

function parseVertical(raw: string | null): ProspectVerticalFilter {
  if (raw === "psap" || raw === "campus" || raw === "venue" || raw === "transit" || raw === "all") {
    return raw;
  }
  return "psap";
}

function parseQuery(params: URLSearchParams): PsapProspectListQuery & {
  vertical: ProspectVerticalFilter;
  listKey?: string;
} {
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
    sortByRaw === "updatedAt" ||
    sortByRaw === "studentCount"
      ? sortByRaw
      : "psapName";
  const sortDir = params.get("sortDir") === "desc" ? "desc" : "asc";
  const listKey = params.get("list") || undefined;

  return {
    vertical: parseVertical(params.get("vertical")),
    listKey,
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

type ClientQuery = PsapProspectListQuery & {
  vertical: ProspectVerticalFilter;
  listKey?: string;
  sortBy?: PsapProspectListQuery["sortBy"] | "studentCount";
};

function queryToParams(q: ClientQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.vertical && q.vertical !== "psap") p.set("vertical", q.vertical);
  if (q.listKey) p.set("list", q.listKey);
  if (q.state) p.set("state", q.state);
  if (q.outreachStatus) p.set("status", q.outreachStatus);
  if (q.search) p.set("search", q.search);
  if (q.hasAddress !== undefined) p.set("hasAddress", String(q.hasAddress));
  if (q.page && q.page > 1) p.set("page", String(q.page));
  if (q.sortBy && q.sortBy !== "psapName") p.set("sortBy", q.sortBy);
  if (q.sortDir && q.sortDir !== "asc") p.set("sortDir", q.sortDir);
  return p;
}

export function PsapProspectsClient({
  actorName,
  actorUserId,
}: {
  actorName?: string;
  actorUserId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const listQuery = useMemo(() => parseQuery(searchParams), [searchParams]);
  const isRegistry = listQuery.vertical === "psap";
  const isOutreach = !isRegistry;

  const [view, setView] = useState<ViewMode>("table");
  const [selected, setSelected] = useState<ProspectTableRow | null>(null);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [outreachTick, setOutreachTick] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === "map" || stored === "table") setView(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isOutreach && view === "map") setView("table");
  }, [isOutreach, view]);

  useEffect(() => {
    setSelected(null);
  }, [listQuery.vertical, listQuery.listKey]);

  const setViewMode = (mode: ViewMode) => {
    setView(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const syncQuery = useCallback(
    (next: ClientQuery) => {
      const qs = queryToParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const statsQuery = useQuery({
    queryKey: ["psap-prospects", "stats"],
    queryFn: getPsapStats,
    enabled: isRegistry,
  });

  const listResult = useQuery({
    queryKey: ["psap-prospects", "list", listQuery],
    queryFn: () => listPsapProspects(listQuery),
    enabled: view === "table" && isRegistry,
  });

  const pinsQuery = useQuery({
    queryKey: ["psap-prospects", "map-pins"],
    queryFn: getPsapMapPins,
    enabled: view === "map" && isRegistry,
    staleTime: 5 * 60_000,
  });

  const outreachList = useMemo(() => {
    if (!isOutreach) {
      return { items: [], total: 0, page: 1, pageSize: 50, hasMore: false };
    }
    return listOutreachAsPsapProspects({
      vertical: listQuery.vertical,
      listKey: listQuery.listKey,
      search: listQuery.search,
      state: listQuery.state,
      outreachStatus: listQuery.outreachStatus,
      hasAddress: listQuery.hasAddress,
      page: listQuery.page,
      pageSize: listQuery.pageSize ?? 50,
      sortBy: listQuery.sortBy,
      sortDir: listQuery.sortDir,
    });
    // outreachTick forces re-read after local CRM patches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOutreach, listQuery, outreachTick]);

  const outreachStats = useMemo(() => {
    if (!isOutreach) return undefined;
    return computeOutreachStats({
      vertical: listQuery.vertical,
      listKey: listQuery.listKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOutreach, listQuery.vertical, listQuery.listKey, outreachTick]);

  const listOptionsForVertical = useMemo(() => {
    if (listQuery.vertical === "all") return OUTREACH_LISTS;
    if (listQuery.vertical === "psap") return [];
    return OUTREACH_LISTS.filter((l) => l.vertical === listQuery.vertical);
  }, [listQuery.vertical]);

  const tableItems = isRegistry ? (listResult.data?.items ?? []) : outreachList.items;
  const tableTotal = isRegistry ? (listResult.data?.total ?? 0) : outreachList.total;
  const tablePage = isRegistry
    ? (listResult.data?.page ?? listQuery.page ?? 1)
    : outreachList.page;
  const tablePageSize = isRegistry
    ? (listResult.data?.pageSize ?? 50)
    : outreachList.pageSize;
  const tableHasMore = isRegistry
    ? (listResult.data?.hasMore ?? false)
    : outreachList.hasMore;
  const activeStats = isRegistry ? statsQuery.data : outreachStats;

  const onStatusChange = async (psapId: string, outreachStatus: PsapOutreachStatus) => {
    if (isOutreach) {
      const current =
        selected?.psapId === psapId
          ? selected
          : outreachList.items.find((p) => p.psapId === psapId);
      if (!current) return;
      const updated = patchOutreachProspectLocal(current, { outreachStatus });
      if (selected?.psapId === psapId) setSelected(updated);
      setOutreachTick((t) => t + 1);
      return;
    }
    const updated = await patchPsapProspect(psapId, { outreachStatus });
    if (selected?.psapId === psapId) setSelected(updated);
    await queryClient.invalidateQueries({ queryKey: ["psap-prospects"] });
  };

  const onSort = (sortBy: NonNullable<ClientQuery["sortBy"]>) => {
    const sortDir =
      listQuery.sortBy === sortBy && listQuery.sortDir === "asc" ? "desc" : "asc";
    syncQuery({ ...listQuery, sortBy, sortDir, page: 1 });
  };

  const showStudentCount =
    listQuery.vertical === "campus" ||
    listQuery.vertical === "all" ||
    Boolean(listQuery.listKey?.startsWith("campus-"));

  const handleBulkEnrich = async () => {
    setBulkEnriching(true);
    setBulkMsg(null);
    try {
      const result = await enrichAllPsapContacts(10);
      setBulkMsg(
        `${result.message}${result.contactsFound != null ? ` (${result.contactsFound} contacts)` : ""}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["psap-prospects"] });
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : "Bulk enrich failed");
    } finally {
      setBulkEnriching(false);
    }
  };

  const handleOutreachExport = () => {
    const all = listOutreachAsPsapProspects({
      vertical: listQuery.vertical,
      listKey: listQuery.listKey,
      search: listQuery.search,
      state: listQuery.state,
      outreachStatus: listQuery.outreachStatus,
      hasAddress: listQuery.hasAddress,
      page: 1,
      pageSize: 100_000,
      sortBy: listQuery.sortBy,
      sortDir: listQuery.sortDir,
    }).items;
    const csv = buildOutreachCsv(all);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexcort-prospects-${listQuery.vertical}${listQuery.listKey ? `-${listQuery.listKey}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const countNoun =
    listQuery.vertical === "psap"
      ? "PSAPs"
      : listQuery.vertical === "campus"
        ? "campuses"
        : listQuery.vertical === "venue"
          ? "venues"
          : listQuery.vertical === "transit"
            ? "agencies"
            : "prospects";

  const subtitle = isRegistry
    ? `National PSAP outreach database${
        statsQuery.data ? ` — ${statsQuery.data.total.toLocaleString()} dispatch centers` : ""
      }. Track outbound contact status separately from inbound Leads CRM.`
    : `${verticalFilterLabel(listQuery.vertical)} outreach lists${
        outreachStats ? ` — ${outreachStats.total.toLocaleString()} prospects` : ""
      }. Same CRM workflow as PSAP (status, filters, detail panel).`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Prospects</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{subtitle}</p>
          {bulkMsg && <p className="mt-1 text-xs text-slate-500">{bulkMsg}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SafetySourceLookupLink variant="chip" />
          {isRegistry && (
            <button
              type="button"
              onClick={() => void handleBulkEnrich()}
              disabled={bulkEnriching}
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              <Sparkles size={11} />
              {bulkEnriching ? "Enriching…" : "Enrich All Contacts"}
            </button>
          )}
          {isRegistry && (
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
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {VERTICAL_OPTIONS.map((v) => {
          const count =
            v === "psap"
              ? statsQuery.data?.total
              : v === "all"
                ? OUTREACH_PROSPECT_COUNTS.total
                : OUTREACH_PROSPECT_COUNTS.byVertical[v];
          return (
            <button
              key={v}
              type="button"
              onClick={() =>
                syncQuery({
                  ...listQuery,
                  vertical: v,
                  listKey: undefined,
                  page: 1,
                })
              }
              className={[
                "rounded-md border px-2.5 py-1 text-[11px] font-semibold transition",
                listQuery.vertical === v
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                  : "border-[#1e2130] bg-[#0f1117] text-slate-500 hover:border-[#2a2f3d] hover:text-slate-300",
              ].join(" ")}
            >
              {verticalFilterLabel(v)}
              {count != null ? ` (${count.toLocaleString()})` : ""}
            </button>
          );
        })}
        {listOptionsForVertical.length > 0 && (
          <select
            value={listQuery.listKey ?? ""}
            onChange={(e) =>
              syncQuery({
                ...listQuery,
                listKey: e.target.value || undefined,
                page: 1,
              })
            }
            className="rounded-md border border-[#1e2130] bg-[#0f1117] px-2 py-1 text-[11px] text-slate-300"
          >
            <option value="">All lists</option>
            {listOptionsForVertical.map((l) => (
              <option key={l.listKey} value={l.listKey}>
                {l.listLabel}
              </option>
            ))}
          </select>
        )}
      </div>

      <PsapStatsStrip
        stats={activeStats}
        isLoading={isRegistry ? statsQuery.isLoading : false}
      />

      <PsapFilterBar
        query={listQuery}
        total={
          isRegistry
            ? view === "table"
              ? tableTotal
              : (pinsQuery.data?.length ?? statsQuery.data?.total ?? 0)
            : tableTotal
        }
        stats={activeStats}
        onChange={(next) => syncQuery({ ...listQuery, ...next, vertical: listQuery.vertical })}
        countNoun={countNoun}
        exportMode={isRegistry ? "api" : "client"}
        onClientExport={handleOutreachExport}
        showVerifiedExportOption={isRegistry}
      />

      {view === "table" || isOutreach ? (
        <div className="relative flex gap-0">
          <div className={`min-w-0 flex-1 ${selected ? "lg:pr-0" : ""}`}>
            <PsapProspectTable
              items={tableItems}
              total={tableTotal}
              page={tablePage}
              pageSize={tablePageSize}
              hasMore={tableHasMore}
              selectedId={selected?.psapId}
              sortBy={listQuery.sortBy}
              sortDir={listQuery.sortDir}
              isLoading={isRegistry ? listResult.isLoading : false}
              nameColumnLabel={isRegistry ? "PSAP Name" : "Name"}
              countyColumnLabel={isRegistry ? "County" : "List"}
              emptyLabel="No prospects match the current filters."
              showStudentCount={showStudentCount && isOutreach}
              onSelect={setSelected}
              onPageChange={(page) => syncQuery({ ...listQuery, page })}
              onSort={onSort}
              onStatusChange={(id, status) => void onStatusChange(id, status)}
            />
            {isRegistry && listResult.isError && (
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
                persistence={isOutreach ? "local" : "api"}
                vertical={listQuery.vertical === "all" ? "psap" : listQuery.vertical}
                studentCount={selected.studentCount}
                actorName={actorName}
                actorUserId={actorUserId}
                onClose={() => setSelected(null)}
                onUpdated={(p) => {
                  setSelected({ ...p, studentCount: selected.studentCount });
                  if (isOutreach) setOutreachTick((t) => t + 1);
                  else void queryClient.invalidateQueries({ queryKey: ["psap-prospects"] });
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
                actorName={actorName}
                actorUserId={actorUserId}
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

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CAD_BRIDGE_MAX_PARTICIPANTS,
  CAD_BRIDGE_VENDOR_LABELS,
  CAD_BRIDGE_VENDORS,
  emptyCadSlotConfig,
  listCadBridgeParticipants,
  nextAvailableCadSlot,
  type CADBridgeConfig,
  type CADSlot,
  type CADSlotConfig,
  type CADVendor,
} from "rapid-cortex-shared";
import {
  fetchCadBridgeAudit,
  fetchCadBridgeConfig,
  fetchCadBridgeConflicts,
  fetchCadBridgeHealth,
  putCadBridgeConfig,
  resolveCadBridgeConflict,
  testCadBridgeConnection,
} from "@/lib/cad-bridge/cad-bridge-api";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";

const VENDORS: readonly CADVendor[] = CAD_BRIDGE_VENDORS;

type Tab = "config" | "health" | "conflicts" | "audit";

export function CadBridgeAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("config");
  const [banner, setBanner] = useState<string | null>(null);
  const [auditIncidentId, setAuditIncidentId] = useState("");
  const writebackUi = isCadWritebackUiEnabled();

  const configQuery = useQuery({ queryKey: ["cad-bridge-config"], queryFn: fetchCadBridgeConfig });
  const healthQuery = useQuery({
    queryKey: ["cad-bridge-health"],
    queryFn: fetchCadBridgeHealth,
    refetchInterval: 15_000,
  });
  const conflictsQuery = useQuery({ queryKey: ["cad-bridge-conflicts"], queryFn: fetchCadBridgeConflicts });
  const auditQuery = useQuery({
    queryKey: ["cad-bridge-audit", auditIncidentId],
    queryFn: () => fetchCadBridgeAudit(auditIncidentId),
    enabled: tab === "audit" && auditIncidentId.trim().length > 0,
  });

  const [draft, setDraft] = useState<CADBridgeConfig | null>(null);
  const config = draft ?? configQuery.data?.config ?? null;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error("No config loaded");
      const { agencyId: _a, createdAt: _c, updatedAt: _u, ...rest } = config;
      return putCadBridgeConfig(rest);
    },
    onSuccess: async (res) => {
      setDraft(res.config);
      setBanner("Bridge configuration saved. The bridge stays disabled until you enable it after UAT.");
      await qc.invalidateQueries({ queryKey: ["cad-bridge-config"] });
    },
    onError: (e: Error) => setBanner(e.message),
  });

  const testMut = useMutation({
    mutationFn: (slot: CADSlot) => testCadBridgeConnection(slot),
    onSuccess: (res) =>
      setBanner(
        `Test ${res.slot} (${res.vendor}): parse ok. Mock=${res.mockMode ? "on" : "off"}. Live health=${res.live.attempted ? (res.live.ok ? "ok" : "failed") : "not attempted"}.`,
      ),
    onError: (e: Error) => setBanner(e.message),
  });

  const resolveMut = useMutation({
    mutationFn: (args: { conflictId: string; keepSlot: CADSlot }) =>
      resolveCadBridgeConflict(args.conflictId, "MANUAL_REVIEW", args.keepSlot),
    onSuccess: async () => {
      setBanner("Conflict resolved.");
      await qc.invalidateQueries({ queryKey: ["cad-bridge-conflicts"] });
    },
    onError: (e: Error) => setBanner(e.message),
  });

  const tabs: Array<{ id: Tab; label: string }> = useMemo(
    () => [
      { id: "config", label: "Configuration" },
      { id: "health", label: "Health" },
      { id: "conflicts", label: "Conflicts" },
      { id: "audit", label: "Audit" },
    ],
    [],
  );

  if (configQuery.isLoading) {
    return <p className="text-sm text-slate-400">Loading CAD Bridge…</p>;
  }
  if (configQuery.isError || !config) {
    return (
      <p className="text-sm text-rose-300">
        Could not load CAD Bridge configuration. {(configQuery.error as Error | undefined)?.message}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-800 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">Admin</p>
        <h1 className="text-2xl font-semibold text-white">CAD Bridge</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          NexCort iQ is the broker, not the source of truth. If RC is unavailable, connected CADs keep operating
          independently — they only stop syncing until RC recovers. Up to {CAD_BRIDGE_MAX_PARTICIPANTS} CADs can join
          one hub. RC stores sync state and audit trails, not a live operational CAD record.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Live partner CAD writes stay fail-closed unless CAD write-back is explicitly enabled.
          {writebackUi ? " Write-back UI is on for this environment." : " Write-back UI is off."}
          {configQuery.data?.mockMode ? " Outbound is in mock mode." : ""}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === item.id ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {banner ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">{banner}</div>
      ) : null}

      {tab === "config" ? (
        <div className="space-y-6">
          {listCadBridgeParticipants(config).map((participant) => (
            <SlotEditor
              key={participant.slot}
              title={participant.label ?? participant.slot.replace("_", " ")}
              slot={
                participant.slot === "CAD_A"
                  ? config.cadA
                  : participant.slot === "CAD_B"
                    ? config.cadB
                    : participant
              }
              onChange={(next) => {
                if (participant.slot === "CAD_A") setDraft({ ...config, cadA: next });
                else if (participant.slot === "CAD_B") setDraft({ ...config, cadB: next });
                else {
                  setDraft({
                    ...config,
                    extraParticipants: (config.extraParticipants ?? []).map((row) =>
                      row.slot === participant.slot ? { ...row, ...next } : row,
                    ),
                  });
                }
              }}
              onRemove={
                participant.slot === "CAD_A" || participant.slot === "CAD_B"
                  ? undefined
                  : () =>
                      setDraft({
                        ...config,
                        extraParticipants: (config.extraParticipants ?? []).filter(
                          (row) => row.slot !== participant.slot,
                        ),
                        primaryCAD:
                          config.primaryCAD === participant.slot ? "CAD_A" : config.primaryCAD,
                      })
              }
            />
          ))}
          {nextAvailableCadSlot(config) ? (
            <button
              type="button"
              className="rounded-lg border border-dashed border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              onClick={() => {
                const slot = nextAvailableCadSlot(config);
                if (!slot) return;
                setDraft({
                  ...config,
                  extraParticipants: [
                    ...(config.extraParticipants ?? []),
                    { slot, label: slot.replace("_", " "), ...emptyCadSlotConfig() },
                  ],
                });
              }}
            >
              Add CAD ({listCadBridgeParticipants(config).length}/{CAD_BRIDGE_MAX_PARTICIPANTS})
            </button>
          ) : (
            <p className="text-xs text-slate-500">Hub is at the {CAD_BRIDGE_MAX_PARTICIPANTS}-CAD maximum.</p>
          )}
          <div className="grid gap-4 rounded-xl border border-slate-800 bg-[#09080f] p-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Primary CAD
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                value={config.primaryCAD}
                onChange={(e) => setDraft({ ...config, primaryCAD: e.target.value as CADSlot })}
              >
                {listCadBridgeParticipants(config).map((p) => (
                  <option key={p.slot} value={p.slot}>
                    {p.label ?? p.slot.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Conflict resolution
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                value={config.conflictResolution}
                onChange={(e) =>
                  setDraft({
                    ...config,
                    conflictResolution: e.target.value as CADBridgeConfig["conflictResolution"],
                  })
                }
              >
                <option value="PRIMARY_WINS">Primary wins</option>
                <option value="LAST_WRITE_WINS">Last write wins</option>
                <option value="MANUAL_REVIEW">Manual review</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setDraft({ ...config, enabled: e.target.checked })}
              />
              Bridge enabled (leave off until UAT)
            </label>
          </div>
          <fieldset className="rounded-xl border border-slate-800 bg-[#09080f] p-4">
            <legend className="px-1 text-sm font-semibold text-slate-200">Sync rules</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(config.syncRules).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) =>
                      setDraft({
                        ...config,
                        syncRules: { ...config.syncRules, [key]: e.target.checked },
                      })
                    }
                  />
                  {key}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => saveMut.mutate()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Save configuration
            </button>
            {listCadBridgeParticipants(config).map((p) => (
              <button
                key={p.slot}
                type="button"
                onClick={() => testMut.mutate(p.slot)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Test {p.label ?? p.slot.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "health" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {(healthQuery.data?.participants && healthQuery.data.participants.length > 0
            ? healthQuery.data.participants.map((row) => ({
                slot: row.slot,
                title: row.label ?? String(row.slot).replace("_", " "),
                vendor: row.vendor,
                circuit: row.circuit,
                inbound: row.inbound,
              }))
            : [
                {
                  slot: "CAD_A",
                  title: "CAD A",
                  vendor: healthQuery.data?.cadA?.vendor,
                  circuit: healthQuery.data?.cadA?.circuit ?? "—",
                  inbound: healthQuery.data?.cadA?.inbound,
                },
                {
                  slot: "CAD_B",
                  title: "CAD B",
                  vendor: healthQuery.data?.cadB?.vendor,
                  circuit: healthQuery.data?.cadB?.circuit ?? "—",
                  inbound: healthQuery.data?.cadB?.inbound,
                },
              ]
          ).map((row) => (
            <HealthCard
              key={row.slot}
              title={row.title}
              data={{ vendor: row.vendor, circuit: row.circuit, inbound: row.inbound }}
            />
          ))}
          <div className="rounded-xl border border-slate-800 bg-[#09080f] p-4 sm:col-span-2">
            <p className="text-sm text-slate-300">Pending buffer size</p>
            <p className="mt-1 text-2xl font-semibold text-white">{healthQuery.data?.pendingBufferSize ?? "—"}</p>
            <p className="mt-2 text-xs text-slate-500">{healthQuery.data?.brokerNotice}</p>
          </div>
        </div>
      ) : null}

      {tab === "conflicts" ? (
        <div className="space-y-3">
          {(conflictsQuery.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No pending conflicts.</p>
          ) : (
            (conflictsQuery.data?.items ?? []).map((item) => (
              <div key={item.conflictId} className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
                <p className="text-sm font-medium text-amber-100">
                  {item.field} · incident {item.rcIncidentId}
                </p>
                <p className="mt-2 text-xs text-slate-400">CAD A: {JSON.stringify(item.cadAValue)}</p>
                <p className="text-xs text-slate-400">CAD B: {JSON.stringify(item.cadBValue)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-sky-700 px-3 py-1 text-xs text-white"
                    onClick={() => resolveMut.mutate({ conflictId: item.conflictId, keepSlot: "CAD_A" })}
                  >
                    Keep CAD A
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-sky-700 px-3 py-1 text-xs text-white"
                    onClick={() => resolveMut.mutate({ conflictId: item.conflictId, keepSlot: "CAD_B" })}
                  >
                    Keep CAD B
                  </button>
                  {item.sourceSlot && item.sourceSlot !== "CAD_A" && item.sourceSlot !== "CAD_B" ? (
                    <button
                      type="button"
                      className="rounded-md bg-sky-700 px-3 py-1 text-xs text-white"
                      onClick={() =>
                        resolveMut.mutate({ conflictId: item.conflictId, keepSlot: item.sourceSlot as CADSlot })
                      }
                    >
                      Keep {item.sourceSlot.replace("_", " ")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="space-y-3">
          <label className="block text-sm text-slate-300">
            RC incident ID
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={auditIncidentId}
              onChange={(e) => setAuditIncidentId(e.target.value)}
              placeholder="rc incident uuid"
            />
          </label>
          {(auditQuery.data?.items ?? []).map((row) => (
            <div key={`${row.eventId}-${row.timestamp}`} className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
              <p>
                {row.timestamp} · {row.eventType} · {row.direction} · {row.outcome}
              </p>
              {row.errorDetail ? <p className="text-rose-300">{row.errorDetail}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SlotEditor({
  title,
  slot,
  onChange,
  onRemove,
}: {
  title: string;
  slot: CADSlotConfig;
  onChange: (next: CADSlotConfig) => void;
  onRemove?: () => void;
}) {
  return (
    <fieldset className="rounded-xl border border-slate-800 bg-[#09080f] p-4">
      <legend className="flex items-center gap-3 px-1 text-sm font-semibold text-slate-200">
        {title}
        {onRemove ? (
          <button type="button" className="text-xs font-normal text-rose-300 hover:text-rose-200" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-300">
          Vendor
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={slot.vendor}
            onChange={(e) => onChange({ ...slot, vendor: e.target.value as CADVendor })}
          >
            {VENDORS.map((v) => (
              <option key={v} value={v}>
                {CAD_BRIDGE_VENDOR_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Base URL
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={slot.baseUrl}
            onChange={(e) => onChange({ ...slot, baseUrl: e.target.value })}
            placeholder="https://cad.example.gov"
          />
        </label>
        <label className="text-sm text-slate-300">
          API key secret ARN
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={slot.apiKeySecretArn}
            onChange={(e) => onChange({ ...slot, apiKeySecretArn: e.target.value })}
            placeholder="arn:aws:secretsmanager:...:secret:rapid-cortex/cad-bridge/..."
          />
        </label>
        <label className="text-sm text-slate-300">
          Webhook signing secret ARN
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={slot.webhookSigningSecretArn}
            onChange={(e) => onChange({ ...slot, webhookSigningSecretArn: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={slot.inboundEnabled}
            onChange={(e) => onChange({ ...slot, inboundEnabled: e.target.checked })}
          />
          Inbound webhooks
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={slot.outboundEnabled}
            onChange={(e) => onChange({ ...slot, outboundEnabled: e.target.checked })}
          />
          Outbound publish
        </label>
        <label className="text-sm text-slate-300">
          Polling interval (seconds, webhook fallback)
          <input
            type="number"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={slot.pollingIntervalSeconds ?? ""}
            onChange={(e) =>
              onChange({
                ...slot,
                pollingIntervalSeconds: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
      </div>
    </fieldset>
  );
}

function HealthCard({
  title,
  data,
}: {
  title: string;
  data?: { vendor?: string; circuit: string; inbound?: boolean };
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#09080f] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">Vendor: {data?.vendor ?? "—"}</p>
      <p className="text-sm text-slate-300">Circuit: {data?.circuit ?? "—"}</p>
      <p className="text-sm text-slate-300">Inbound: {data?.inbound ? "enabled" : "disabled"}</p>
    </div>
  );
}

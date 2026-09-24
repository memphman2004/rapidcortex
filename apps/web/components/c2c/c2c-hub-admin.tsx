"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CAD_BRIDGE_VENDOR_LABELS,
  CAD_BRIDGE_VENDORS,
  type CADSlot,
  type CADVendor,
} from "rapid-cortex-shared";
import { fetchC2cHealth, fetchC2cSlots, patchC2cSlot } from "@/lib/c2c/c2c-api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 flex items-start gap-2">
        <span className="min-w-0 flex-1 break-all font-mono text-slate-300">{value}</span>
        <button
          type="button"
          className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:bg-slate-800"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </dd>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-600 bg-slate-900"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function healthTone(status: string | undefined, enabled: boolean): string {
  if (status === "ONLINE") return "bg-emerald-900/60 text-emerald-300";
  if (!enabled) return "bg-slate-800 text-slate-400";
  if (status === "DEGRADED") return "bg-amber-900/60 text-amber-200";
  if (status === "OFFLINE") return "bg-rose-900/60 text-rose-200";
  return "bg-amber-900/60 text-amber-200";
}

export function C2cHubAdminPage() {
  const qc = useQueryClient();
  const to = useJurisdictionLink();
  const writebackUi = isCadWritebackUiEnabled();
  const slotsQuery = useQuery({ queryKey: ["c2c-slots"], queryFn: fetchC2cSlots });
  const healthQuery = useQuery({
    queryKey: ["c2c-health"],
    queryFn: fetchC2cHealth,
    refetchInterval: 15_000,
  });

  const patchMut = useMutation({
    mutationFn: ({ slot, patch }: { slot: CADSlot; patch: Parameters<typeof patchC2cSlot>[1] }) =>
      patchC2cSlot(slot, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["c2c-slots"] });
      await qc.invalidateQueries({ queryKey: ["c2c-health"] });
    },
  });

  const slots = slotsQuery.data?.slots ?? [];
  const healthByAgency = new Map((healthQuery.data?.agencies ?? []).map((a) => [a.agencyId, a]));
  const online = healthQuery.data?.agencies.filter((a) => a.status === "ONLINE").length ?? 0;
  const enabledCount = slots.filter((s) => s.enabled).length;

  if (slotsQuery.isLoading) {
    return <p className="text-sm text-slate-400">Loading C2C Hub…</p>;
  }
  if (slotsQuery.isError) {
    const status = (slotsQuery.error as { status?: number } | null)?.status;
    const forbidden = status === 403;
    return (
      <div className="space-y-3 text-sm">
        <p className="text-rose-300">
          Could not load C2C Hub.{" "}
          {forbidden
            ? "This configuration page is limited to agency admins and IT."
            : (slotsQuery.error as Error).message}
        </p>
        {forbidden ? (
          <Link
            href={to("/dashboard")}
            className="inline-flex text-sky-400 hover:text-sky-300"
          >
            Return to dashboard
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-200">
      <header className="border-b border-slate-800 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">Admin</p>
        <h1 className="text-2xl font-semibold text-white">C2C Hub</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          NexCort iQ brokers NENA EIDO between up to eight CAD systems. Each slot is independent:
          turn it on, accept inbound webhooks, and enable outbound only when that CAD should receive
          incidents. Vendor HTTP waits for the secret JSON at the listed ARN. NexCort iQ is not the
          CAD of record.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Live partner CAD writes stay fail-closed unless CAD write-back is explicitly enabled.
          {writebackUi ? " Write-back UI is on for this environment." : " Write-back UI is off."}
          {slotsQuery.data?.writebackEnabled ? "" : " API write-back is fail-closed."}{" "}
          <Link href={to("/admin/cad")} className="text-sky-400 hover:text-sky-300">
            CAD Integrations
          </Link>
          {" · "}
          <Link href={to("/admin/cad/bridge")} className="text-sky-400 hover:text-sky-300">
            CAD Bridge
          </Link>
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-[#09080f] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Slots on</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {enabledCount} / {slots.length || 8}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#09080f] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Vendor health</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {online} online
            <span className="ml-2 text-xs font-normal uppercase text-slate-500">
              {healthQuery.data?.status ?? "waiting"}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#09080f] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Outbound writes</p>
          <p className="mt-1 text-lg font-semibold text-amber-200">
            {slotsQuery.data?.writebackEnabled ? "Write-back on" : "Fail-closed"}
          </p>
        </div>
      </div>

      {patchMut.isError ? (
        <div className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {(patchMut.error as Error).message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {slots.map((slot) => {
          const health = healthByAgency.get(`${slotsQuery.data?.agencyId}:${slot.slot}`);
          return (
            <section key={slot.slot} className="rounded-xl border border-slate-800 bg-[#09080f] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <label className="block text-[11px] uppercase tracking-wide text-slate-500">Label</label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white"
                    defaultValue={slot.label}
                    onBlur={(e) => {
                      const label = e.target.value.trim();
                      if (label && label !== slot.label) {
                        patchMut.mutate({ slot: slot.slot, patch: { label } });
                      }
                    }}
                  />
                  <p className="mt-1 font-mono text-[11px] text-slate-500">{slot.slot}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${healthTone(health?.status, slot.enabled)}`}
                >
                  {health?.status ?? (slot.enabled ? "waiting" : "off")}
                </span>
              </div>
              <label className="mt-3 block text-[11px] uppercase tracking-wide text-slate-500">Vendor</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={slot.vendor}
                onChange={(e) =>
                  patchMut.mutate({ slot: slot.slot, patch: { vendor: e.target.value as CADVendor } })
                }
              >
                {CAD_BRIDGE_VENDORS.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {CAD_BRIDGE_VENDOR_LABELS[vendor]}
                  </option>
                ))}
              </select>
              <div className="mt-4 flex flex-wrap gap-4">
                <Toggle
                  label="Slot on"
                  checked={slot.enabled}
                  disabled={patchMut.isPending}
                  onChange={(enabled) => patchMut.mutate({ slot: slot.slot, patch: { enabled } })}
                />
                <Toggle
                  label="Inbound"
                  checked={slot.inboundEnabled}
                  disabled={patchMut.isPending || !slot.enabled}
                  onChange={(inboundEnabled) => patchMut.mutate({ slot: slot.slot, patch: { inboundEnabled } })}
                />
                <Toggle
                  label="Outbound"
                  checked={slot.outboundEnabled}
                  disabled={patchMut.isPending || !slot.enabled}
                  onChange={(outboundEnabled) => patchMut.mutate({ slot: slot.slot, patch: { outboundEnabled } })}
                />
              </div>
              <dl className="mt-4 space-y-3 text-[11px] text-slate-400">
                <CopyField label="Webhook" value={slot.webhookUrl} />
                <CopyField label="Secret JSON" value={slot.credentialsSecretArn} />
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}

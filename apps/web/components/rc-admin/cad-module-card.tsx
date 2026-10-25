"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { patchAdminCadModule } from "@/lib/api";
import { useAdminCadModule } from "@/lib/hooks/use-cad-module";

type Props = {
  agencyId: string;
  agencyName: string;
  canEdit: boolean;
};

function formatWhen(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function CadModuleCard({ agencyId, agencyName, canEdit }: Props) {
  const queryClient = useQueryClient();
  const query = useAdminCadModule(agencyId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [seatsDraft, setSeatsDraft] = useState<number | null>(null);

  const feature = query.data?.feature ?? null;
  const enabled = feature?.enabled === true;
  const seatCount = query.data?.seatCount ?? 0;
  const seats = seatsDraft ?? feature?.maxCadSeats ?? 5;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["cad-module", agencyId] });
    await queryClient.invalidateQueries({ queryKey: ["cad-module", "self"] });
  }

  async function toggle(next: boolean) {
    if (!canEdit || pending) return;
    setError(null);
    let confirmAgencyName: string | undefined;
    if (!next && seatCount > 0) {
      const typed = window.prompt(
        `This agency has ${seatCount} users with active CAD access. Disabling CAD removes their console access immediately. Their seat assignments stay on file. Type the agency name to confirm.`,
      );
      if (typed === null) return;
      if (typed.trim().toLowerCase() !== agencyName.trim().toLowerCase()) {
        setError("Agency name did not match. CAD stays on.");
        return;
      }
      confirmAgencyName = typed.trim();
    }
    setPending(true);
    try {
      await patchAdminCadModule(agencyId, {
        enabled: next,
        ...(next ? { maxCadSeats: Math.min(500, Math.max(1, seats)) } : {}),
        ...(confirmAgencyName ? { confirmAgencyName } : {}),
      });
      setSeatsDraft(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update CAD");
    } finally {
      setPending(false);
    }
  }

  async function saveSeats() {
    if (!canEdit || !enabled || pending) return;
    setError(null);
    setPending(true);
    try {
      await patchAdminCadModule(agencyId, { maxCadSeats: Math.min(500, Math.max(1, seats)) });
      setSeatsDraft(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the seat count");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">CAD dispatch module</h2>
        <span
          className={
            enabled
              ? "rounded bg-emerald-950/70 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-300"
              : "rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-400"
          }
        >
          {enabled ? "ENABLED" : "DISABLED"}
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-xs text-slate-500">
        Turn this on after the CAD contract is signed. Agency administrators can then assign seats up to the
        contracted count. Turning it off hides the CAD console. Assigned seats stay on file.
      </p>

      {query.isLoading ? <p className="mt-3 text-xs text-slate-500">Loading CAD settings…</p> : null}
      {query.isError ? (
        <p className="mt-3 text-xs text-rose-300">
          {query.error instanceof Error ? query.error.message : "Could not load CAD settings"}
        </p>
      ) : null}

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!canEdit || pending || query.isLoading}
          onChange={(event) => void toggle(event.target.checked)}
        />
        Status
      </label>
      {enabled && feature?.enabledAt ? (
        <p className="mt-1 text-xs text-slate-500">
          Enabled {formatWhen(feature.enabledAt)}
          {feature.enabledBy ? ` by ${feature.enabledBy}` : ""}
        </p>
      ) : null}
      {!enabled && feature?.disabledAt ? (
        <p className="mt-1 text-xs text-slate-500">
          Disabled {formatWhen(feature.disabledAt)}
          {feature.disabledBy ? ` by ${feature.disabledBy}` : ""}
        </p>
      ) : null}

      {enabled ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Max CAD seats
            <input
              type="number"
              min={1}
              max={500}
              value={seats}
              disabled={!canEdit || pending}
              onChange={(event) => setSeatsDraft(Number(event.target.value))}
              className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={!canEdit || pending || seats === feature?.maxCadSeats}
            onClick={() => void saveSeats()}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
          >
            Save seats
          </button>
          <p className="text-xs text-slate-500">
            {seatCount} of {feature?.maxCadSeats ?? seats} seats assigned
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
    </section>
  );
}

"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Plus, X } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

type RecentMci = {
  mciId: string;
  name: string;
  activatedAt: string;
  severity: string;
};

function recentKey(agencyId: string) {
  return `nexcort-mci-recent:${agencyId}`;
}

export function MciClient({ params }: Props) {
  const { jurisdiction } = use(params);
  const router = useRouter();
  const { user } = useSession();
  const agencyId = user?.agencyId || jurisdiction;
  const enabled = isFeaturesSuiteUiEnabled();

  const [recent, setRecent] = useState<RecentMci[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [incidentType, setIncidentType] = useState("MCI");
  const [severity, setSeverity] = useState<"minor" | "moderate" | "major" | "catastrophic">(
    "major",
  );
  const [lat, setLat] = useState("39.1");
  const [lon, setLon] = useState("-84.5");
  const [locationAddress, setLocationAddress] = useState("");
  const [linkedIncidentId, setLinkedIncidentId] = useState("");
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(recentKey(agencyId));
      if (raw) setRecent(JSON.parse(raw) as RecentMci[]);
    } catch {
      /* ignore */
    }
  }, [agencyId]);

  const activateMut = useMutation({
    mutationFn: () =>
      featureSuiteFetch<{ mciId: string; message: string }>("mci", {
        method: "POST",
        body: JSON.stringify({
          name,
          incidentType,
          severity,
          location: {
            address: locationAddress || name || "MCI scene",
            lat: Number(lat),
            lon: Number(lon),
          },
          linkedIncidentId: linkedIncidentId || undefined,
        }),
      }),
    onSuccess: (res) => {
      const entry: RecentMci = {
        mciId: res.mciId,
        name,
        activatedAt: new Date().toISOString(),
        severity,
      };
      const next = [entry, ...recent.filter((r) => r.mciId !== res.mciId)].slice(0, 20);
      setRecent(next);
      try {
        localStorage.setItem(recentKey(agencyId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setOpen(false);
      router.push(`/${jurisdiction}/operations/mci/${res.mciId}`);
    },
  });

  if (!enabled) {
    return <div className="p-6 text-sm text-slate-400">MCI command is not enabled.</div>;
  }

  return (
    <div className="min-h-full space-y-6 bg-[#0f1117] p-4 md:p-6 text-[#e2e4ea]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            MCI Command
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Activate a mass-casualty incident and open the command console.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          <Plus className="h-4 w-4" />
          Activate MCI
        </button>
      </div>

      <section className="rounded-lg border border-slate-800 bg-[#161b2e] p-4">
        <h2 className="mb-2 text-sm font-semibold">Open by ID</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={openId}
            onChange={(e) => setOpenId(e.target.value)}
            placeholder="MCI ID"
            className="min-w-[240px] flex-1 rounded border border-slate-700 bg-[#0f1117] px-3 py-2 font-mono text-sm"
          />
          <button
            type="button"
            disabled={!openId.trim()}
            onClick={() =>
              router.push(`/${jurisdiction}/operations/mci/${encodeURIComponent(openId.trim())}`)
            }
            className="rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
          >
            Open console
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Recent activations</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((r) => (
            <button
              key={r.mciId}
              type="button"
              onClick={() => router.push(`/${jurisdiction}/operations/mci/${r.mciId}`)}
              className="rounded-lg border border-red-900/40 bg-red-950/20 p-4 text-left hover:border-red-700/60"
            >
              <div className="font-medium text-white">{r.name}</div>
              <div className="mt-1 text-xs capitalize text-red-200/80">{r.severity}</div>
              <div className="mt-2 font-mono text-[10px] text-slate-500">{r.mciId}</div>
              <div className="mt-1 text-xs text-slate-500">
                {new Date(r.activatedAt).toLocaleString()}
              </div>
            </button>
          ))}
          {recent.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-slate-500">
              No recent MCIs in this browser. Activate one to begin.
            </p>
          )}
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-[#161b2e] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Activate MCI</h3>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="Event name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                placeholder="Incident type"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as typeof severity)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              >
                {(["minor", "moderate", "major", "catastrophic"] as const).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
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
              <input
                placeholder="Linked CAD / incident ID (optional)"
                value={linkedIncidentId}
                onChange={(e) => setLinkedIncidentId(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!name.trim() || activateMut.isPending}
                onClick={() => activateMut.mutate()}
                className="w-full rounded bg-red-700 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                Activate
              </button>
              {activateMut.isError && (
                <p className="text-xs text-red-400">{(activateMut.error as Error).message}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

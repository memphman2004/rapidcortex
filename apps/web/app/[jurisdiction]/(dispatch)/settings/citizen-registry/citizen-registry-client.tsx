"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Download,
  QrCode,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { CitizenProfile } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type LookupResponse = { found: boolean; profile?: CitizenProfile };

type Props = { params: Promise<{ jurisdiction: string }> };

function profileName(p: CitizenProfile): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.preferredName || "—";
}

export function CitizenRegistryClient({ params }: Props) {
  const { jurisdiction } = use(params);
  const { user } = useSession();
  const qc = useQueryClient();
  const enabled = isFeaturesSuiteUiEnabled();

  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [profiles, setProfiles] = useState<CitizenProfile[]>([]);
  const [selected, setSelected] = useState<CitizenProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const registrationUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const agency = user?.agencyId || jurisdiction;
    return `${window.location.origin}/citizen-register?agencyId=${encodeURIComponent(agency)}`;
  }, [user?.agencyId, jurisdiction]);

  const lookupQ = useQuery({
    queryKey: ["citizen-registry-lookup", submitted],
    queryFn: async () => {
      const q = submitted.trim();
      const isPhone = /\d{7,}/.test(q.replace(/\D/g, ""));
      const path = isPhone
        ? `citizens/lookup?phone=${encodeURIComponent(q)}`
        : `citizens/lookup?address=${encodeURIComponent(q)}`;
      return featureSuiteFetch<LookupResponse>(path);
    },
    enabled: enabled && submitted.trim().length >= 3,
  });

  useEffect(() => {
    if (lookupQ.data?.found && lookupQ.data.profile) {
      const p = lookupQ.data.profile;
      setProfiles((prev) => {
        if (prev.some((x) => x.profileId === p.profileId)) return prev;
        return [p, ...prev];
      });
    }
  }, [lookupQ.data]);

  useEffect(() => {
    let cancelled = false;
    if (!registrationUrl) return;
    void (async () => {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(registrationUrl, {
        width: 220,
        margin: 1,
        color: { dark: "#0f1117", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      });
      if (!cancelled) setQrDataUrl(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [registrationUrl]);

  const deleteMut = useMutation({
    mutationFn: (profileId: string) =>
      featureSuiteFetch(`citizens/${encodeURIComponent(profileId)}`, { method: "DELETE" }),
    onSuccess: (_d, profileId) => {
      setProfiles((prev) => prev.filter((p) => p.profileId !== profileId));
      setSelected(null);
      setConfirmDelete(false);
      void qc.invalidateQueries({ queryKey: ["citizen-registry-lookup"] });
    },
  });

  const updateMut = useMutation({
    mutationFn: (profileId: string) =>
      featureSuiteFetch(`citizens/${encodeURIComponent(profileId)}`, {
        method: "PUT",
        body: JSON.stringify({
          specialInstructions: editNotes,
          accessNotes: editNotes,
        }),
      }),
    onSuccess: () => {
      if (selected) {
        const next = { ...selected, specialInstructions: editNotes, accessNotes: editNotes };
        setSelected(next);
        setProfiles((prev) => prev.map((p) => (p.profileId === next.profileId ? next : p)));
      }
      setEditing(false);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const blob = `${p.phoneE164} ${p.firstName} ${p.lastName} ${p.address?.street}`.toLowerCase();
      return blob.includes(q);
    });
  }, [profiles, search]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return {
      total: profiles.length,
      newThisMonth: profiles.filter((p) => p.createdAt >= monthStart).length,
      medical: profiles.filter((p) => (p.medicalConditions?.length ?? 0) > 0).length,
      mobility: profiles.filter((p) => p.mobilityStatus && p.mobilityStatus !== "ambulatory").length,
    };
  }, [profiles]);

  if (!enabled) {
    return (
      <div className="p-6 text-sm text-slate-400">Citizen registry is not enabled for this environment.</div>
    );
  }

  return (
    <div className="min-h-full space-y-6 bg-[#0f1117] p-4 md:p-6 text-[#e2e4ea]">
      <div>
        <h1 className="text-lg font-semibold text-white">Citizen Safety Registry</h1>
        <p className="mt-1 text-sm text-slate-400">
          Look up enrolled citizen profiles by phone or address. Search results accumulate in this session.
        </p>
      </div>

      {/* Panel A — stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Enrolled (session)", value: stats.total, icon: Users },
          { label: "New this month", value: stats.newThisMonth },
          { label: "Medical flags", value: stats.medical },
          { label: "Mobility limitations", value: stats.mobility },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-slate-800 bg-[#161b2e] px-4 py-3"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-sky-300">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Panel B — search + table */}
      <section className="rounded-lg border border-slate-800 bg-[#161b2e]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSubmitted(search);
              }}
              placeholder="Search by phone or address…"
              className="w-full rounded-md border border-slate-700 bg-[#0f1117] py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600"
            />
          </div>
          <button
            type="button"
            onClick={() => setSubmitted(search)}
            className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            Look up
          </button>
        </div>

        {lookupQ.isFetching && (
          <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>
        )}
        {lookupQ.isError && (
          <p className="px-3 py-2 text-xs text-red-400">{(lookupQ.error as Error).message}</p>
        )}
        {lookupQ.data && !lookupQ.data.found && submitted && (
          <p className="px-3 py-2 text-xs text-amber-300">No profile found for “{submitted}”.</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Phone</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Language</th>
                <th className="px-3 py-2 font-semibold">Mobility</th>
                <th className="px-3 py-2 font-semibold">Medical</th>
                <th className="px-3 py-2 font-semibold">Updated</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    No profiles loaded. Search by phone or address to begin.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.profileId}
                    onClick={() => {
                      setSelected(p);
                      setEditing(false);
                      setEditNotes(p.specialInstructions || p.accessNotes || "");
                    }}
                    className="cursor-pointer border-b border-slate-800/80 hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{p.phoneE164}</td>
                    <td className="px-3 py-2">{profileName(p)}</td>
                    <td className="px-3 py-2 text-slate-400">{p.primaryLanguage}</td>
                    <td className="px-3 py-2 capitalize text-slate-400">
                      {p.mobilityStatus.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {p.medicalConditions?.length ?? 0}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {new Date(p.lastUpdatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-sky-400 hover:text-sky-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(p);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Panel C — QR */}
      <section className="rounded-lg border border-slate-800 bg-[#161b2e] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <QrCode className="h-4 w-4 text-sky-400" />
          Registration link
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Citizens scan this QR or open the link to self-enroll for agency{" "}
          <span className="font-mono text-slate-300">{user?.agencyId || jurisdiction}</span>.
        </p>
        <div className="flex flex-wrap items-start gap-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Citizen registration QR" className="rounded bg-white p-2" width={160} height={160} />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded bg-slate-900 text-xs text-slate-500">
              Generating…
            </div>
          )}
          <div className="space-y-2">
            <code className="block max-w-md break-all rounded border border-slate-700 bg-[#0f1117] px-2 py-1.5 text-[11px] text-slate-300">
              {registrationUrl}
            </code>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(registrationUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1.5 rounded border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy link"}
              </button>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`citizen-register-${user?.agencyId || jurisdiction}.png`}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download QR
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
          <div className="flex h-full w-full max-w-md flex-col border-l border-slate-700 bg-[#161b2e] shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <h2 className="font-semibold text-white">{profileName(selected)}</h2>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-500">Contact</div>
                <p className="font-mono text-xs">{selected.phoneE164}</p>
                <p className="text-slate-300">
                  {selected.address.street}, {selected.address.city}, {selected.address.state}{" "}
                  {selected.address.zip}
                </p>
                <p className="text-slate-400">Language: {selected.primaryLanguage}</p>
                <span className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-sky-300">
                  {selected.enrolledVia.replace(/_/g, " ")}
                </span>
              </div>

              {selected.medicalConditions && selected.medicalConditions.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Medical</div>
                  <ul className="mt-1 space-y-1">
                    {selected.medicalConditions.map((m, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] uppercase text-amber-200">
                          {m.severity}
                        </span>
                        {m.condition}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.householdMembers && selected.householdMembers.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Household</div>
                  <ul className="mt-1 space-y-0.5 text-slate-300">
                    {selected.householdMembers.map((h, i) => (
                      <li key={i}>
                        {h.name || "Member"} ({h.relationship})
                        {h.specialNeeds ? ` — ${h.specialNeeds}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.pets && selected.pets.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Pets</div>
                  <ul className="mt-1 space-y-0.5">
                    {selected.pets.map((pet, i) => (
                      <li key={i} className={pet.aggressive ? "text-red-400" : "text-slate-300"}>
                        {pet.name} ({pet.species}
                        {pet.breed ? `, ${pet.breed}` : ""})
                        {pet.aggressive ? " — aggressive" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.accessNotes && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Access notes</div>
                  <p className="text-slate-300">{selected.accessNotes}</p>
                </div>
              )}

              {selected.specialInstructions && (
                <div className="rounded border border-amber-700/50 bg-amber-950/30 p-3 text-amber-100">
                  <div className="text-[10px] font-semibold uppercase text-amber-300/80">
                    Special instructions
                  </div>
                  <p className="mt-1">{selected.specialInstructions}</p>
                </div>
              )}

              {editing && (
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">
                    Edit notes / instructions
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded border border-slate-700 bg-[#0f1117] p-2 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-700 p-3">
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
                >
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() => updateMut.mutate(selected.profileId)}
                  className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  Save
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 rounded border border-red-800 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-[#161b2e] p-4">
            <h3 className="font-semibold text-white">Delete profile?</h3>
            <p className="mt-2 text-sm text-slate-400">
              This removes the profile per right-to-delete request.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(selected.profileId)}
                className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                Confirm delete
              </button>
            </div>
            {deleteMut.isError && (
              <p className="mt-2 text-xs text-red-400">{(deleteMut.error as Error).message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

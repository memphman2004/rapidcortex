"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ChannelDiscipline } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import {
  CHANNEL_COLOR_PRESETS,
  CHANNEL_DISCIPLINE_OPTIONS,
  createAgencyChannel,
  deactivateAgencyChannel,
  fetchAgencyChannels,
  isApiConfigured,
  patchAgencyChannel,
} from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isChannelMonitoringEnabled } from "@/lib/runtime-flags";

function isChannelAdmin(role: string | undefined): boolean {
  return role === "agencyadmin" || role === "agencyit" || role === "rcsuperadmin";
}

export default function AdminChannelsSettingsPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<ChannelDiscipline>("law");
  const [description, setDescription] = useState("");
  const [talkGroupId, setTalkGroupId] = useState("");
  const [color, setColor] = useState(CHANNEL_COLOR_PRESETS[0]?.hex ?? "#3b82f6");
  const [formError, setFormError] = useState<string | null>(null);

  const channelsQuery = useQuery({
    queryKey: ["agency-channels"],
    queryFn: () => fetchAgencyChannels(),
    enabled: isApiConfigured() && isChannelMonitoringEnabled() && isChannelAdmin(user?.role),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAgencyChannel({
        name: name.trim(),
        discipline,
        description: description.trim() || undefined,
        talkGroupId: talkGroupId.trim() || undefined,
        color,
      }),
    onSuccess: () => {
      setShowForm(false);
      setName("");
      setDescription("");
      setTalkGroupId("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["agency-channels"] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ channelId, active }: { channelId: string; active: boolean }) =>
      active
        ? patchAgencyChannel(channelId, { active: true })
        : deactivateAgencyChannel(channelId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agency-channels"] }),
  });

  if (!user) return null;

  if (!isChannelAdmin(user.role)) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-300">You do not have permission to configure talk groups.</p>
      </div>
    );
  }

  if (!isChannelMonitoringEnabled()) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <h1 className="text-lg font-semibold text-white">Channel / Talk Group Configuration</h1>
        <p className="max-w-xl text-sm text-slate-400">
          Channel monitoring isn’t enabled for this agency. Contact Rapid Cortex support.
        </p>
        <Link href={to("/admin/settings")} className="text-sm text-sky-400 hover:underline">
          ← Back to settings
        </Link>
      </div>
    );
  }

  const channels = channelsQuery.data?.channels ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400/90">
          Configuration
        </p>
        <h1 className="text-lg font-semibold text-white">Channel / Talk Group Configuration</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Configure radio talk groups and channels available to dispatchers during incidents.
        </p>
        <p className="mt-2 text-sm">
          <Link href={to("/admin/settings")} className="text-sky-400 hover:underline">
            ← Environment & compliance settings
          </Link>
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{channels.length} configured channel(s)</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
        >
          {showForm ? "Cancel" : "Add channel"}
        </button>
      </div>

      {showForm ? (
        <form
          className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              setFormError("Name is required");
              return;
            }
            createMutation.mutate();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-300">Name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="LAW-ALPHA"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Discipline</span>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as ChannelDiscipline)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {CHANNEL_DISCIPLINE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-300">Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Law enforcement sector alpha"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Talk group ID (optional)</span>
              <input
                value={talkGroupId}
                onChange={(e) => setTalkGroupId(e.target.value)}
                placeholder="Vendor radio ID"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="block text-sm">
              <span className="text-slate-300">Color</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHANNEL_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    onClick={() => setColor(preset.hex)}
                    className={`h-8 w-8 rounded-full ring-2 ${color === preset.hex ? "ring-white" : "ring-transparent"}`}
                    style={{ backgroundColor: preset.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
          {formError ? <p className="text-sm text-rose-300">{formError}</p> : null}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving…" : "Create channel"}
          </button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Discipline</th>
              <th className="px-3 py-2 font-medium">Talk group ID</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {channelsQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : channels.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-slate-500">
                  No channels configured yet.
                </td>
              </tr>
            ) : (
              channels.map((ch) => (
                <tr key={ch.channelId} className="border-t border-slate-800/80">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: ch.color ?? "#64748b" }}
                      />
                      {ch.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {CHANNEL_DISCIPLINE_OPTIONS.find((o) => o.value === ch.discipline)?.label ??
                      ch.discipline}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{ch.talkGroupId ?? "—"}</td>
                  <td className="px-3 py-2">
                    {ch.active ? (
                      <span className="text-emerald-300">Active</span>
                    ) : (
                      <span className="text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={toggleActiveMutation.isPending}
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          channelId: ch.channelId,
                          active: !ch.active,
                        })
                      }
                      className="text-xs text-sky-400 hover:underline"
                    >
                      {ch.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

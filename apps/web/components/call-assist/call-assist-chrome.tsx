"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { CallAssistUiProfile } from "rapid-cortex-shared";
import { patchCallAssistShift } from "@/lib/call-assist/call-assist-api";
import { canSetCallAssistShift } from "@/lib/call-assist/access";
import { useSession } from "@/components/auth/session-context";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";

const SHIFT_SUGGESTIONS = ["A shift", "B shift", "C shift", "Day shift", "Night shift", "Event day"];

export function CallAssistChrome({
  title,
  profile: profileProp,
}: {
  title: string;
  profile?: CallAssistUiProfile | undefined;
}) {
  const { user } = useSession();
  const { config, requestAgencyId, refresh } = useCallAssistConfig();
  const profile = profileProp ?? config ?? undefined;
  const [shiftDraft, setShiftDraft] = useState("");
  const [shiftOpen, setShiftOpen] = useState(false);
  const canShift = canSetCallAssistShift(user?.role);
  const setShift = useMutation({
    mutationFn: (currentShift: string) => patchCallAssistShift(currentShift, requestAgencyId),
    onSuccess: () => {
      setShiftDraft("");
      setShiftOpen(false);
      void refresh();
    },
  });
  const agencyLine = [profile?.shortName, profile?.shiftLabel].filter(Boolean).join(" · ");
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3">
      <div>
        <h1 className="text-[15px] font-semibold text-slate-100">{title}</h1>
        {agencyLine ? <p className="mt-0.5 text-[11px] text-slate-500">{agencyLine}</p> : null}
      </div>
      {profile ? (
        <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
          {profile.userRole}
        </span>
      ) : null}
      {canShift ? (
        <div className="relative">
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:text-white"
            onClick={() => setShiftOpen((open) => !open)}
          >
            Set shift
          </button>
          {shiftOpen ? (
            <form
              className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-lg"
              onSubmit={(e) => {
                e.preventDefault();
                const v = shiftDraft.trim();
                if (v) setShift.mutate(v);
              }}
            >
              <input
                className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px]"
                placeholder="Shift name"
                value={shiftDraft}
                onChange={(e) => setShiftDraft(e.target.value)}
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {SHIFT_SUGGESTIONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white"
                    onClick={() => setShift.mutate(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="submit" className="mt-1.5 text-[10px] text-sky-400" disabled={setShift.isPending}>
                Save
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      {profile ? (
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-700 text-[9px] font-semibold text-white">
            {profile.userInitials}
          </span>
          {profile.userName}
        </div>
      ) : null}
    </div>
  );
}

export function CallAssistWave({ compact = false }: { compact?: boolean }) {
  const heights = compact ? [4, 10, 6] : [5, 13, 7, 14, 6];
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[3px] animate-pulse rounded-sm bg-sky-400"
          style={{ height: h, animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

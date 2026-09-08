"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { CallAssistChrome } from "@/components/call-assist/call-assist-chrome";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { isApiConfigured } from "@/lib/api";
import { canCallAssistRecords } from "@/lib/call-assist/access";
import { getCallAssistRecordsRequests, postCallAssistRecordsRequest } from "@/lib/call-assist/call-assist-api";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

export default function CallAssistRecordsPage() {
  const { user } = useSession();
  const { config, runtime, requestAgencyId, agencyId, ready } = useCallAssistConfig();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const allowed = canCallAssistRecords(user?.role);
  const enabled = Boolean(user && isApiConfigured() && isCallAssistEnabled() && allowed && ready);
  const listQuery = useQuery({
    queryKey: ["call-assist-records", agencyId],
    queryFn: () => getCallAssistRecordsRequests(requestAgencyId),
    enabled,
  });
  const createMut = useMutation({
    mutationFn: () =>
      postCallAssistRecordsRequest(
        {
          requestorName: name,
          requestorEmail: email,
          dateFrom,
          dateTo,
        },
        requestAgencyId,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["call-assist-records"] });
      setName("");
      setEmail("");
    },
  });

  if (!user) return null;
  if (!allowed) {
    return <p className="p-6 text-sm text-rose-300">You do not have permission to manage public records requests.</p>;
  }
  if (!isCallAssistEnabled()) {
    return <p className="p-6 text-sm text-slate-400">Call Assist is not enabled.</p>;
  }

  const items = (listQuery.data?.items ?? []) as Array<{
    requestId: string;
    requestorName: string;
    status: string;
    dateFrom: string;
    dateTo: string;
  }>;
  const retention = (runtime?.config.retention ?? {}) as {
    governingLaw?: string | null;
    policyName?: string | null;
    audioRetentionDays?: number;
    transcriptRetentionDays?: number;
  };
  const retentionLabel =
    config?.governingLaw ??
    retention.governingLaw ??
    retention.policyName ??
    config?.retentionLabel ??
    "Agency retention policy";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <CallAssistChrome title="Call Assist public records" />
      <p className="max-w-2xl text-sm text-slate-400">
        Retention and legal hold follow {retentionLabel}
        {typeof retention.audioRetentionDays === "number" ? ` · audio ${retention.audioRetentionDays} days` : ""}
        {typeof retention.transcriptRetentionDays === "number"
          ? ` · transcripts ${retention.transcriptRetentionDays} days`
          : ""}
        . Exports are chain-of-custody logged; deletion is blocked while a legal hold is set.
      </p>
      <form
        className="grid max-w-xl gap-3 rounded-lg border border-slate-800 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          createMut.mutate();
        }}
      >
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          placeholder="Requestor name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          placeholder="Requestor email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          required
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          required
        />
        <button type="submit" className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white" disabled={createMut.isPending}>
          Open records request
        </button>
      </form>
      <ul className="space-y-2 text-sm text-slate-300">
        {items.map((row) => (
          <li key={row.requestId} className="rounded border border-slate-800 px-3 py-2">
            {row.requestId} · {row.requestorName} · {row.status} · {row.dateFrom}–{row.dateTo}
          </li>
        ))}
      </ul>
    </div>
  );
}

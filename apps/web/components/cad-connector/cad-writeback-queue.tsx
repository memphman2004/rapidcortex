"use client";

import { useEffect, useState } from "react";
import type { CadWriteBackRequest, UserContext } from "rapid-cortex-shared";
import { canApproveWriteBack } from "@/lib/cad-connector/cad-authz";
import { approveCadWriteBack, fetchCadWriteBacks, rejectCadWriteBack } from "@/lib/cad-connector/cad-connector-api";

export function CadWriteBackQueue({ user }: { user: UserContext }) {
  const [items, setItems] = useState<CadWriteBackRequest[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canApprove = canApproveWriteBack(user, user.agencyId);

  async function reload() {
    setItems(await fetchCadWriteBacks("?status=pending_approval"));
  }

  useEffect(() => {
    void reload().catch((err: unknown) => setError(err instanceof Error ? err.message : "Load failed"));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-white">Write-back approval queue</h1>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Incident</th>
            <th>Action</th>
            <th>Requested by</th>
            <th>Requested at</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.writeBackId} className="border-t border-slate-800">
              <td className="py-2">{row.unifiedId}</td>
              <td>{row.payload.action}</td>
              <td>{row.requestedByUserId}</td>
              <td>{new Date(row.requestedAt).toLocaleString()}</td>
              <td>{row.status}</td>
              <td className="space-x-2 text-right">
                {canApprove && row.status === "pending_approval" ? (
                  <>
                    <button type="button" className="text-emerald-400" onClick={() => void approveCadWriteBack(row.writeBackId).then(reload)}>
                      Approve
                    </button>
                    <button type="button" className="text-red-400" onClick={() => setRejectId(row.writeBackId)}>
                      Reject
                    </button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rejectId ? (
        <div className="mt-4 rounded border border-slate-700 p-3">
          <textarea
            className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
            minLength={20}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (min 20 characters)"
          />
          <button
            type="button"
            className="mt-2 rounded bg-red-800 px-3 py-1 text-sm"
            disabled={reason.trim().length < 20}
            onClick={() => {
              void rejectCadWriteBack(rejectId, reason).then(() => {
                setRejectId(null);
                setReason("");
                return reload();
              });
            }}
          >
            Confirm reject
          </button>
        </div>
      ) : null}
    </div>
  );
}

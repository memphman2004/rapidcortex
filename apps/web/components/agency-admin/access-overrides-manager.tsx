"use client";

import type { AgencyTenant, AuditEvent, UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { useCallback, useEffect, useState } from "react";
import {
  type AccessOverrideRecordApi,
  fetchAgencies,
  fetchAgencyAdminAccessOverridesList,
  fetchAuditEvents,
  fetchPlatformAuditEvents,
  patchAgencyAdminAccessOverrideRevoke,
  postAgencyAdminAccessOverride,
} from "@/lib/api";
import { StatusBadge } from "@/components/dashboards/status-badge";
import type { StatusTone } from "@/lib/dashboards/mockDashboardData";
import { AccessDenied } from "@/components/dashboards/access-denied";

function statusToneFromOverride(
  raw:
    | NonNullable<AccessOverrideRecordApi["effectiveStatus"]>
    | AccessOverrideRecordApi["status"],
): StatusTone {
  if (raw === "active") return "active";
  if (raw === "revoked") return "resolved";
  if (raw === "expired") return "offline";
  return "pending";
}

/** Optional small hook to auto-dismiss banners */
function useAutoClearToast(toast: { tone: "ok" | "err"; text: string } | null, setter: (v: null) => void) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setter(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast, setter]);
}

export function AccessOverridesManager({ initialUser }: { initialUser: UserContext }) {
  const user = initialUser;
  const platformOperator = isRcInternalOperator(user.role);
  const canManage = user.role === "agencyadmin" || platformOperator;

  const [agencyId, setAgencyId] = useState(() =>
    platformOperator ? "" : user.agencyId,
  );
  const [agencies, setAgencies] = useState<AgencyTenant[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);

  const [items, setItems] = useState<AccessOverrideRecordApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  useAutoClearToast(toast, () => setToast(null));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "revoked" | "expired"
  >("active");

  const [createOpen, setCreateOpen] = useState(false);
  const [createConfirm, setCreateConfirm] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [targetUserId, setTargetUserId] = useState("");
  const [overrideType, setOverrideType] =
    useState<AccessOverrideRecordApi["overrideType"]>("permission");
  const [grantedRoleOrPermission, setGrantedRoleOrPermission] = useState("dashboard:qa");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [detail, setDetail] = useState<AccessOverrideRecordApi | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);

  function isApiReady(): boolean {
    return platformOperator ? Boolean(agencyId) : Boolean(user.agencyId);
  }

  useEffect(() => {
    if (!platformOperator) return;
    setLoadingAgencies(true);
    void fetchAgencies()
      .then((a) => {
        setAgencies(a);
        if (!agencyId && a.length) setAgencyId(a[0]!.agencyId);
      })
      .catch(() => {})
      .finally(() => setLoadingAgencies(false));
  }, [user, agencyId]);

  const refresh = useCallback(async () => {
    if (!isApiReady()) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAgencyAdminAccessOverridesList({
        agencyId: platformOperator ? agencyId : undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load overrides");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, agencyId, statusFilter, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadAuditTrail(row: AccessOverrideRecordApi) {
    setDetail(row);
    try {
      const candidates = platformOperator
        ? await fetchPlatformAuditEvents({ limit: 300, agencyId: row.agencyId })
        : await fetchAuditEvents(300);
      setAuditTrail(
        candidates.filter((e) =>
          typeof e.details === "object" && e.details
            ? JSON.stringify(e.details).includes(row.overrideId)
            : false,
        ),
      );
    } catch {
      setAuditTrail([]);
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 4 || !createConfirm || !targetUserId.trim()) {
      setToast({ tone: "err", text: "Complete required acknowledgement and rationale (min 4 chars)." });
      return;
    }
    setCreateSubmitting(true);
    try {
      await postAgencyAdminAccessOverride({
        targetUserId: targetUserId.trim(),
        overrideType,
        grantedRoleOrPermission: grantedRoleOrPermission.trim(),
        reason: reason.trim(),
        expiresAt: expiresAt.trim() || undefined,
        agencyId: platformOperator ? agencyId : undefined,
      });
      setToast({ tone: "ok", text: "Override granted" });
      setCreateOpen(false);
      await refresh();
      setReason("");
      setExpiresAt("");
      setTargetUserId("");
      setCreateConfirm(false);
    } catch (err) {
      setToast({ tone: "err", text: err instanceof Error ? err.message : "Grant failed" });
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function confirmRevoke() {
    if (!detail) return;
    if (revokeReason.trim().length < 4) {
      setToast({ tone: "err", text: "Provide revocation reason (min 4 chars)" });
      return;
    }
    setRevokeSubmitting(true);
    try {
      await patchAgencyAdminAccessOverrideRevoke({
        overrideId: detail.overrideId,
        reason: revokeReason.trim(),
        agencyId: platformOperator ? detail.agencyId : undefined,
      });
      setToast({ tone: "ok", text: "Override revoked" });
      setRevokeOpen(false);
      setRevokeReason("");
      setDetail(null);
      await refresh();
    } catch (err) {
      setToast({ tone: "err", text: err instanceof Error ? err.message : "Revoke failed" });
    } finally {
      setRevokeSubmitting(false);
    }
  }

  if (!canManage) {
    return <AccessDenied user={user} />;
  }

  const es = (row: AccessOverrideRecordApi) => row.effectiveStatus ?? row.status;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-xl font-semibold text-white">Per-user feature access</h1>
        <p className="mt-1 max-w-prose text-sm text-slate-400">
          Grant individual users extra roles, permissions, or feature flags without changing their
          base Cognito group. Choose override type <strong className="font-normal text-slate-300">Feature flag</strong>{" "}
          and set the grant descriptor (for example{" "}
          <span className="font-mono text-slate-300">feature:video_assist</span> or{" "}
          <span className="font-mono text-slate-300">dashboard:qa</span>). Records are
          append-only; revocation keeps audit history. Dashboard grants sync to{" "}
          <span className="font-mono text-slate-400">custom:dashboardAccess</span> on the next token.
        </p>
        <p className="mt-3 text-xs text-amber-200/90">
          Warning: Sensitive — every save issues immutable audit-ready entries.
        </p>
      </div>

      {toast ? (
        <p className={`text-sm ${toast.tone === "ok" ? "text-emerald-400" : "text-rose-400"}`}>
          {toast.text}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        {platformOperator ? (
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Tenant scope (required)
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              disabled={loadingAgencies}
            >
              <option value="">Select agency…</option>
              {agencies.map((a) => (
                <option key={a.agencyId} value={a.agencyId}>
                  {(a.name as string | undefined) ?? a.agencyId}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="font-mono text-xs text-slate-500">{user.agencyId}</span>
        )}
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Status
          <select
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-slate-400">
          Search
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="Email, Cognito subject, dashboard grant fragment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button
          type="button"
          disabled={
            !(platformOperator ? agencyId && !loading : user.agencyId && !loading)
          }
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-40"
        >
          Grant override…
        </button>
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Effective</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Grant</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading overrides…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No matching overrides.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const tone = es(row);
                return (
                  <tr
                    key={row.overrideId}
                    className="cursor-pointer hover:bg-slate-900/70"
                    onClick={() => void loadAuditTrail(row)}
                  >
                    <td className="px-4 py-2 text-xs text-slate-300">
                      <StatusBadge tone={statusToneFromOverride(tone)} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-indigo-200">
                      {row.targetUserEmail || row.targetUserId}
                    </td>
                    <td className="max-w-[260px] px-4 py-2 text-xs">{row.grantedRoleOrPermission}</td>
                    <td className="px-4 py-2 text-xs capitalize text-slate-400">{row.overrideType}</td>
                    <td className="max-w-[220px] truncate px-4 py-2 text-xs text-slate-500" title={row.reason}>
                      {row.reason}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {row.expiresAt ?? "None"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={(e) => void submitCreate(e)}
            className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-white">Grant override</h2>
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm">
                <span className="block text-xs text-slate-400">Target user email or Cognito sub</span>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs text-slate-400">Override type</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                  value={overrideType}
                  onChange={(e) =>
                    setOverrideType(e.target.value as AccessOverrideRecordApi["overrideType"])
                  }
                >
                  <option value="role">Role</option>
                  <option value="permission">Permission</option>
                  <option value="feature">Feature flag</option>
                  <option value="incident-access">Incident access</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-xs text-slate-400">Grant descriptor</span>
                <input
                  required
                  placeholder="dispatcher | dashboard:qa | feature:video_assist …"
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs"
                  value={grantedRoleOrPermission}
                  onChange={(e) => setGrantedRoleOrPermission(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs text-slate-400">Operational justification</span>
                <textarea
                  rows={4}
                  required
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs text-slate-400">Expires (ISO UTC, optional)</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs"
                  placeholder="2026-12-31T23:59:59.000Z"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
              <label className="flex gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={createConfirm} onChange={(e) => setCreateConfirm(e.target.checked)} />I
                understand this audited action may immediately elevate access.
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={createSubmitting}
                  type="submit"
                  className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {createSubmitting ? "Saving…" : "Grant"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {detail ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-950 px-4 py-6 text-sm shadow-2xl">
          <button
            type="button"
            className="mb-4 text-xs text-slate-500 underline"
            onClick={() => setDetail(null)}
          >
            Close
          </button>
          <h3 className="text-base font-semibold text-white">Override detail</h3>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded border border-slate-900 bg-black/30 p-3 text-[11px] text-slate-400">
            {JSON.stringify(detail, null, 2)}
          </pre>
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-slate-600">Matched audit excerpts</p>
            <ul className="mt-3 space-y-3 text-[11px] text-slate-400">
              {auditTrail.slice(0, 35).map((evt) => (
                <li key={evt.eventId} className="rounded border border-slate-900 p-3">
                  <span className="text-sky-400/90">{evt.type}</span> ·{" "}
                  <span className="text-slate-500">{evt.createdAt}</span>
                  <pre className="mt-2 max-h-40 overflow-auto text-[10px] text-slate-500">
                    {JSON.stringify(evt.details ?? {}, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </div>
          {detail.status !== "revoked" ? (
            <>
              <button
                type="button"
                className="mt-6 w-full rounded-md border border-rose-800 bg-rose-950/70 py-2 text-xs text-rose-100 hover:bg-rose-950"
                onClick={() => setRevokeOpen(true)}
              >
                Prepare revocation…
              </button>
            </>
          ) : (
            <p className="mt-4 text-xs text-slate-500">Historical — cannot revoke twice.</p>
          )}
        </aside>
      ) : null}

      {revokeOpen && detail ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-rose-900/70 bg-slate-950 p-6">
            <h3 className="text-lg font-semibold text-white">Revoke override</h3>
            <textarea
              rows={4}
              className="mt-4 w-full rounded-md border border-rose-900/40 bg-slate-900 px-3 py-2 text-sm"
              placeholder="Document why access should end."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={revokeSubmitting}
                className="flex-1 rounded-md bg-rose-700 px-4 py-2 text-sm text-white disabled:opacity-40"
                onClick={() => void confirmRevoke()}
              >
                Revoke permanently
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-4 py-2 text-sm"
                onClick={() => setRevokeOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

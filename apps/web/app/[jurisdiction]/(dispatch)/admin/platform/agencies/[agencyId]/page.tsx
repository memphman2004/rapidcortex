"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  fetchAgency,
  fetchAgencyInvites,
  fetchAdminUsers,
  patchAgency,
  postAgencyInvite,
  postAgencySharePartner,
} from "@/lib/api";
import type { AgencyTenant, CreateInviteInput } from "rapid-cortex-shared";
import { AgencyDetailHeader } from "@/components/platform/agency-detail-header";
import { OnboardingChecklistCard } from "@/components/platform/onboarding-checklist-card";
import { deriveVerticalFromAgencyId, normalizeVertical } from "@/components/ui/VerticalBadge";

export default function AgencyDetailPage() {
  const to = useJurisdictionLink();
  const params = useParams();
  const agencyId = typeof params.agencyId === "string" ? params.agencyId : "";
  const queryClient = useQueryClient();
  const agencyQuery = useQuery({
    queryKey: ["agency", agencyId],
    queryFn: () => fetchAgency(agencyId),
    enabled: Boolean(agencyId),
  });
  const invitesQuery = useQuery({
    queryKey: ["agency-invites", agencyId],
    queryFn: () => fetchAgencyInvites(agencyId),
    enabled: Boolean(agencyId),
  });
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  });

  const [invite, setInvite] = useState<CreateInviteInput>({
    email: "",
    role: "agencyadmin",
    expiresInDays: 14,
  });
  const [partnerId, setPartnerId] = useState("");

  const suspendMut = useMutation({
    mutationFn: () => patchAgency(agencyId, { status: "suspended" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agency", agencyId] }),
  });

  const activateMut = useMutation({
    mutationFn: () => patchAgency(agencyId, { status: "active" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agency", agencyId] }),
  });

  const pilotMut = useMutation({
    mutationFn: () => patchAgency(agencyId, { status: "pilot" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agency", agencyId] }),
  });

  const inviteMut = useMutation({
    mutationFn: () => postAgencyInvite(agencyId, invite),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agency-invites", agencyId] });
      setInvite({ email: "", role: "agencyadmin", expiresInDays: 14 });
    },
  });

  const shareMut = useMutation({
    mutationFn: () => postAgencySharePartner(agencyId, partnerId.trim()),
    onSuccess: () => setPartnerId(""),
  });

  const a = agencyQuery.data;
  const tenantUsers = (usersQuery.data ?? []).filter((u) => u.agencyId === agencyId);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <p className="text-sm text-slate-500">
        <Link href={to("/admin/platform/agencies")} className="text-sky-300 hover:underline">
          ← Agency directory
        </Link>
      </p>

      {agencyQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading agency…</p>
      ) : agencyQuery.isError || !a ? (
        <p className="text-sm text-rose-300">Agency not found or failed to load.</p>
      ) : (
        <>
          <AgencyDetailHeader
            name={a.name}
            agencyId={a.agencyId}
            status={a.status}
            type={a.type}
            vertical={normalizeVertical((a as AgencyTenant & { vertical?: string }).vertical ?? deriveVerticalFromAgencyId(a.agencyId))}
            planTier={(a as AgencyTenant & { planTier?: string }).planTier}
          />

          <div className="flex flex-wrap gap-2">
            {a.status === "suspended" ? (
              <button
                type="button"
                disabled={activateMut.isPending}
                onClick={() => activateMut.mutate()}
                className="rounded-md border border-emerald-800/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-950/60 disabled:opacity-40"
              >
                Set active
              </button>
            ) : null}
            {a.status !== "pilot" && a.status !== "suspended" ? (
              <button
                type="button"
                disabled={pilotMut.isPending}
                onClick={() => pilotMut.mutate()}
                className="rounded-md border border-sky-800/50 bg-sky-950/30 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-950/50 disabled:opacity-40"
              >
                Mark pilot
              </button>
            ) : null}
            {a.status !== "suspended" ? (
              <button
                type="button"
                disabled={suspendMut.isPending}
                onClick={() => suspendMut.mutate()}
                className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-950/60 disabled:opacity-40"
              >
                Suspend
              </button>
            ) : null}
            <Link
              href={to(`/admin/billing/agency/${encodeURIComponent(agencyId)}`)}
              className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Billing
            </Link>
            <Link
              href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/features`}
              className="rounded-md border border-violet-800/60 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-950/60"
            >
              Feature add-ons
            </Link>
          </div>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Profile</h2>
            <dl className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Region</dt>
                <dd>{a.region}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Contact</dt>
                <dd>
                  {a.primaryContactName} · {a.primaryContactEmail}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Users (Cognito sample)</dt>
                <dd>
                  {usersQuery.isLoading
                    ? "…"
                    : `${tenantUsers.length} user(s) with this agencyId in pool list`}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tenant configuration
            </h2>
            <p className="mt-1 text-xs text-slate-500">Embedded config — read-only view for quick ops</p>
            <dl className="mt-3 space-y-1 text-xs text-slate-300">
              <div className="flex justify-between gap-2 border-b border-slate-800/60 py-1">
                <span className="text-slate-500">Deployment</span> {a.deploymentMode}
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/60 py-1">
                <span className="text-slate-500">Protocol pack</span> {a.protocolPackId}
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/60 py-1">
                <span className="text-slate-500">Config integration</span> {a.config.integrationMode}
              </div>
            </dl>
          </section>

          <OnboardingChecklistCard
            agencyId={a.agencyId}
            steps={a.config.platformOnboarding?.steps ?? {}}
            notesByStep={a.config.platformOnboarding?.notesByStep}
            agencyNote={a.config.platformOnboarding?.agencyNote}
          />

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Invites</h2>
            <p className="mt-0.5 text-xs text-slate-500">First admin is typically invited here</p>
            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                inviteMut.mutate();
              }}
            >
              <label className="text-sm">
                <span className="text-slate-400">Email</span>
                <input
                  type="email"
                  required
                  value={invite.email}
                  onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
                  className="mt-1 block w-full min-w-[200px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-400">Role</span>
                <select
                  value={invite.role}
                  onChange={(e) =>
                    setInvite((i) => ({
                      ...i,
                      role: e.target.value as CreateInviteInput["role"],
                    }))
                  }
                  className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="agencyadmin">agency admin</option>
                  <option value="supervisor">communications supervisor</option>
                  <option value="dispatcher">dispatcher</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={inviteMut.isPending}
                className="rounded-md bg-sky-900/60 px-3 py-2 text-sm font-medium text-white ring-1 ring-sky-500/25 hover:bg-sky-800/60 disabled:opacity-50"
              >
                {inviteMut.isPending ? "Sending…" : "Create invite"}
              </button>
            </form>
            {inviteMut.isError ? (
              <p className="mt-2 text-xs text-rose-400">
                {inviteMut.error instanceof Error ? inviteMut.error.message : "Invite failed"}
              </p>
            ) : null}
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {(invitesQuery.data ?? []).length === 0 ? (
                <li className="text-slate-500">No invites yet.</li>
              ) : (
                (invitesQuery.data ?? []).map((inv) => (
                  <li key={inv.inviteId} className="rounded-md border border-slate-800/80 px-3 py-2">
                    <span className="font-mono text-xs text-slate-500">{inv.inviteId}</span> · {inv.email} ·
                    {inv.role} · {inv.status}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Share partner
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Link a partner agency for shared incident workflows (API-backed).
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="text-sm">
                <span className="text-slate-400">Partner agencyId</span>
                <input
                  className="mt-1 block w-full min-w-[200px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={!partnerId.trim() || shareMut.isPending}
                onClick={() => shareMut.mutate()}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-40"
              >
                {shareMut.isPending ? "…" : "Set partner link"}
              </button>
            </div>
            {shareMut.isError ? (
              <p className="mt-2 text-xs text-rose-300">
                {shareMut.error instanceof Error ? shareMut.error.message : "Request failed"}
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-800 border-dashed bg-slate-900/20 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Support</h2>
            <p className="mt-1 text-sm text-slate-500">
              No dedicated per-agency support ticket stream is wired in this build. Use the{" "}
              <Link href={to("/admin/platform/support")} className="text-sky-300 hover:underline">
                support queue
              </Link>{" "}
              for internal notes and follow-ups, or the agency&apos;s own admin threads.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

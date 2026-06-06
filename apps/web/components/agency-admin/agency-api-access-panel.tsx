"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserContext } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { AccessDenied } from "@/components/dashboards/access-denied";
import {
  fetchAgencyAdminApiClients,
  fetchAgencyAdminWebhooks,
  patchAgencyAdminApiClientStatus,
  postAgencyAdminApiClient,
  postAgencyAdminApiClientRotate,
  postAgencyAdminWebhook,
} from "@/lib/api";

type Props = { initialUser: UserContext };

export function AgencyApiAccessPanel({ initialUser }: Props) {
  const [clients, setClients] = useState<unknown[] | null>(null);
  const [webhooks, setWebhooks] = useState<unknown[] | null>(null);
  const [agencyFilter, setAgencyFilter] = useState(initialUser.agencyId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rcOps = isRcsuperadmin(initialUser);

  const canManage = initialUser.role === "agencyadmin" || isRcsuperadmin(initialUser);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [c, w] = await Promise.all([
        fetchAgencyAdminApiClients(rcOps ? agencyFilter : undefined),
        fetchAgencyAdminWebhooks(rcOps ? agencyFilter : undefined),
      ]);
      setClients(c);
      setWebhooks(w);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setClients(null);
      setWebhooks(null);
    } finally {
      setBusy(false);
    }
  }, [agencyFilter, rcOps]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!canManage) return <AccessDenied user={initialUser} />;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-xl font-semibold text-white">Agency REST API clients</h1>
        <p className="mt-1 max-w-prose text-sm text-slate-400">
          Machine-to-machine access uses OAuth&nbsp;2.0-style client credentials. Agency metadata is inferred from JWT
          claims—the API never trusts a raw <span className="font-mono">agencyId</span> from request bodies alone.
          Every call is audited.
        </p>
      </div>
      {rcOps ? (
        <div className="mb-6 flex gap-4 items-center">
          <label className="text-sm font-medium">
            Agency ID
            <input
              className="ml-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
              value={agencyFilter}
              onChange={(ev) => setAgencyFilter(ev.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500"
            onClick={() => void refresh()}
          >
            Load
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">API clients</h2>
        <p className="mb-4 text-sm text-neutral-400">
          Secrets are revealed only once at creation or rotation. Store them in your KMS or secret manager—not in
          browser history or chat logs.
        </p>
        <CreateClientForm
          disabled={busy}
          onSubmit={async (body) => {
            try {
              setBusy(true);
              const merged = rcOps ? { ...body, agencyId: agencyFilter.trim() } : body;
              const res = await postAgencyAdminApiClient(merged);
              alert(
                `Client created.\nSecret (copy once): ${String((res as { clientSecret?: string }).clientSecret ?? "")}`,
              );
              await refresh();
            } catch (err: unknown) {
              alert(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        />
        <ClientsTable clients={clients} loading={busy} onDisable={(id) => void disableRow(id)} onRotate={(id) => void rotateRow(id)} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Webhooks</h2>
        <WebhookForm
          disabled={busy}
          onSubmit={async (body) => {
            try {
              setBusy(true);
              const merged = rcOps ? { ...body, agencyId: agencyFilter.trim() } : body;
              const res = (await postAgencyAdminWebhook(merged)) as { signingSecret?: string };
              alert(`Webhook created.\nSigning secret (copy once): ${res.signingSecret ?? ""}`);
              await refresh();
            } catch (err: unknown) {
              alert(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        />
        <WebhooksTable webhooks={webhooks} loading={busy} />
      </section>
    </div>
  );

  async function disableRow(clientId: string) {
    if (!confirm(`Disable API client ${clientId}? Existing tokens will stop working.`)) return;
    try {
      setBusy(true);
      await patchAgencyAdminApiClientStatus(clientId, { status: "disabled" }, rcOps ? agencyFilter : undefined);
      await refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function rotateRow(clientId: string) {
    if (!confirm(`Rotate secret for ${clientId}? Capture the value immediately; old integrations will fail.`)) return;
    try {
      setBusy(true);
      const out = await postAgencyAdminApiClientRotate(clientId, rcOps ? agencyFilter : undefined);
      alert(`New secret:\n${out.clientSecret ?? ""}`);
      await refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
}

function ClientsTable(props: {
  clients: unknown[] | null;
  loading: boolean;
  onDisable: (id: string) => void;
  onRotate: (id: string) => void;
}) {
  if (!props.clients && props.loading) {
    return <p className="text-sm text-neutral-400">Loading…</p>;
  }
  if (!props.clients?.length) {
    return <p className="text-sm text-neutral-400">No API clients configured yet.</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-neutral-800 bg-neutral-950">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-neutral-900 text-neutral-300">
          <tr>
            <th className="px-3 py-2 font-medium">Client ID</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Scopes</th>
            <th className="px-3 py-2 font-medium">Env</th>
            <th className="px-3 py-2 font-medium">Last used</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {props.clients.map((row) => {
            const r = row as Record<string, unknown>;
            const id = String(r.clientId ?? "");
            return (
              <tr key={id} className="border-t border-neutral-900">
                <td className="px-3 py-2 font-mono text-xs">{id}</td>
                <td className="px-3 py-2">{String(r.clientName ?? "")}</td>
                <td className="px-3 py-2">{String(r.status ?? "")}</td>
                <td className="px-3 py-2">{Array.isArray(r.scopes) ? (r.scopes as string[]).join(", ") : ""}</td>
                <td className="px-3 py-2 capitalize">{String(r.environment ?? "")}</td>
                <td className="px-3 py-2">{r.lastUsedAt ? String(r.lastUsedAt) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-900"
                    onClick={() => props.onRotate(id)}
                  >
                    Rotate secret
                  </button>
                  <button
                    type="button"
                    className="ml-2 rounded border border-rose-900 bg-rose-950/60 px-2 py-0.5 text-xs text-rose-100 hover:bg-rose-900/80"
                    onClick={() => props.onDisable(id)}
                  >
                    Disable
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WebhooksTable({ webhooks, loading }: { webhooks: unknown[] | null; loading: boolean }) {
  if (!webhooks && loading) return <p className="text-sm text-neutral-400 mt-6">Loading webhooks…</p>;
  if (!webhooks?.length) return <p className="text-sm text-neutral-400 mt-6">No webhooks yet.</p>;
  return (
    <div className="overflow-auto rounded-lg border border-neutral-800 bg-neutral-950 mt-6">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-900 text-neutral-300">
          <tr>
            <th className="px-3 py-2 font-medium">URL</th>
            <th className="px-3 py-2 font-medium">Events</th>
            <th className="px-3 py-2 font-medium">Failures</th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map((w) => {
            const row = w as Record<string, unknown>;
            const id = String(row.webhookId ?? "");
            return (
              <tr key={id} className="border-t border-neutral-900">
                <td className="px-3 py-2">{String(row.targetUrl ?? "")}</td>
                <td className="px-3 py-2">{Array.isArray(row.eventTypes) ? (row.eventTypes as string[]).join(", ") : ""}</td>
                <td className="px-3 py-2">{String(row.failureCount ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CreateClientForm(props: {
  disabled: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("Production integration");
  const [scopesCsv, setScopesCsv] = useState(
    "incidents:read,incidents:write,transcript:write,ai:summary",
  );

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium flex flex-col gap-1">
          Client label
          <input
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
          />
        </label>
        <label className="text-sm font-medium flex flex-col gap-1">
          Scopes (comma-separated)
          <textarea
            className="min-h-[72px] rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs"
            value={scopesCsv}
            onChange={(ev) => setScopesCsv(ev.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={props.disabled}
        className="mt-3 rounded bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-500 disabled:opacity-60"
        onClick={() =>
          props.onSubmit({
            clientName: name,
            scopes: scopesCsv.split(",").map((s) => s.trim()).filter(Boolean),
            rateLimitTier: "standard",
            environment: "production",
          })
        }
      >
        Create OAuth client credentials
      </button>
    </div>
  );
}

function WebhookForm(props: { disabled: boolean; onSubmit: (body: Record<string, unknown>) => Promise<void> }) {
  const [url, setUrl] = useState("https://example.org/api/rc-webhooks");
  const [eventsCsv, setEventsCsv] = useState("incident.created,incident.updated,transcript.received,ai_summary.ready");

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 mb-6">
      <label className="block text-sm font-medium mb-2">Target HTTPS URL</label>
      <input
        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 mb-3"
        value={url}
        onChange={(ev) => setUrl(ev.target.value)}
      />
      <label className="block text-sm font-medium mb-2">Event types</label>
      <textarea
        className="mb-4 w-full min-h-[64px] rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs"
        value={eventsCsv}
        onChange={(ev) => setEventsCsv(ev.target.value)}
      />
      <button
        type="button"
        disabled={props.disabled}
        className="rounded bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-60"
        onClick={() =>
          props.onSubmit({
            targetUrl: url,
            eventTypes: eventsCsv.split(",").map((s) => s.trim()).filter(Boolean),
          })
        }
      >
        Save webhook receiver
      </button>
    </div>
  );
}

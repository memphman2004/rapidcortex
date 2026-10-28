"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmAgentPrompt, type CrmIntegrationSettings, type CrmSoonProvider } from "rapid-cortex-shared";
import { useState } from "react";

const QUERY_KEY = ["rc-admin-crm-integrations"] as const;

async function readSettings(): Promise<CrmIntegrationSettings> {
  const res = await fetch("/api/rc-admin/leads/integrations");
  const body = (await res.json().catch(() => ({}))) as { data?: CrmIntegrationSettings; error?: string };
  if (!res.ok) throw new Error(body.error || "Could not load integrations");
  if (!body.data) throw new Error("Could not load integrations");
  return body.data;
}

async function sendJson(path: string, method: string, payload?: unknown): Promise<void> {
  const res = await fetch(path, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error || "Request failed");
}

const SOON: Array<{ id: CrmSoonProvider; name: string; blurb: string }> = [
  { id: "zapier", name: "Zapier", blurb: "Send a replied lead into the Zap you already use." },
  { id: "salesforce", name: "Salesforce", blurb: "Create the contact and opportunity in Salesforce." },
  { id: "pipedrive", name: "Pipedrive", blurb: "Open the deal in your Pipedrive pipeline." },
];

export function CrmIntegrationsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: QUERY_KEY, queryFn: readSettings });
  const [token, setToken] = useState("");
  const [portalId, setPortalId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    setNotice(null);
    await qc.invalidateQueries({ queryKey: QUERY_KEY });
  };

  const connect = useMutation({
    mutationFn: () =>
      sendJson("/api/rc-admin/leads/integrations/hubspot", "PUT", {
        accessToken: token,
        portalId: portalId.trim() || undefined,
      }),
    onSuccess: async () => {
      setToken("");
      setNotice("HubSpot is connected. The next reply on a lead creates a contact and a deal.");
      await refresh();
    },
  });

  const disconnect = useMutation({
    mutationFn: () => sendJson("/api/rc-admin/leads/integrations/hubspot", "DELETE"),
    onSuccess: async () => {
      setNotice("HubSpot sync is off. Existing contacts and deals stay in HubSpot.");
      await refresh();
    },
  });

  const notify = useMutation({
    mutationFn: (input: { provider: CrmSoonProvider; email: string }) =>
      sendJson("/api/rc-admin/leads/integrations/notify", "POST", input),
    onSuccess: async () => {
      setNotice("We'll use that address when this connection is ready.");
      await refresh();
    },
  });

  const saveWebhook = useMutation({
    mutationFn: () =>
      sendJson("/api/rc-admin/leads/integrations/webhook", "PUT", {
        url: webhookUrl,
        enabled: true,
      }),
    onSuccess: async () => {
      setWebhookUrl("");
      setNotice("The webhook will receive a lead when someone replies.");
      await refresh();
    },
  });

  const data = settings.data;
  const prompt = crmAgentPrompt(typeof window === "undefined" ? "https://app.rapidcortex.us" : window.location.origin);

  return (
    <div className="space-y-6">
      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </p>
      ) : null}
      {connect.error || disconnect.error || notify.error || saveWebhook.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {(connect.error || disconnect.error || notify.error || saveWebhook.error)?.message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-[#0d1b35] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-lg font-bold text-orange-300">
              H
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">HubSpot</h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
                  {data?.hubspot.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-slate-400">
                When a lead replies, NexCort creates a HubSpot contact and a deal. Log the email as a reply
                on the lead for that to happen.
              </p>
            </div>
          </div>
          {data?.hubspot.connected ? (
            <button
              type="button"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Disconnect
            </button>
          ) : null}
        </div>
        {data?.hubspot.connected ? (
          <p className="mt-4 text-xs text-slate-500">
            Connected {data.hubspot.connectedAt ? new Date(data.hubspot.connectedAt).toLocaleString() : ""}
            {data.hubspot.portalId ? ` · Portal ${data.hubspot.portalId}` : ""}
          </p>
        ) : (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              connect.mutate();
            }}
          >
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="HubSpot private app token"
              className="rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
            />
            <input
              value={portalId}
              onChange={(event) => setPortalId(event.target.value)}
              placeholder="Portal id"
              className="rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              disabled={token.trim().length < 20 || connect.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Connect HubSpot
            </button>
          </form>
        )}
      </section>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">All integrations</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {SOON.map((item) => (
            <NotifyCard
              key={`${item.id}-${data?.notify[item.id] ?? ""}`}
              name={item.name}
              blurb={item.blurb}
              savedEmail={data?.notify[item.id]}
              pending={notify.isPending}
              onSubmit={(email) => notify.mutate({ provider: item.id, email })}
            />
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-dashed border-violet-400/30 bg-[#0d1b35] p-5">
        <h2 className="text-base font-semibold text-white">Custom webhook</h2>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          A public https address receives the lead when someone replies. The HubSpot token is not included.
        </p>
        {data?.webhook.enabled && data.webhook.url ? (
          <p className="mt-3 truncate text-xs text-slate-500">Sending replies to {data.webhook.url}</p>
        ) : null}
        <form
          className="mt-4 flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveWebhook.mutate();
          }}
        >
          <input
            type="url"
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://example.com/nexcort-leads"
            className="min-w-[16rem] flex-1 rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
          />
          <button
            type="submit"
            disabled={!webhookUrl.startsWith("https://") || saveWebhook.isPending}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Save webhook
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0d1b35] p-5">
        <h2 className="text-base font-semibold text-white">Hand this to an assistant</h2>
        <p className="mt-1 text-sm text-slate-400">
          Paste this into Claude, ChatGPT, or Cursor. It tells the assistant how the connection works and
          not to ask for the token.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-[#050c1a] p-4 text-xs leading-relaxed text-slate-300">
          {prompt}
        </pre>
        <button
          type="button"
          className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </section>
    </div>
  );
}

function NotifyCard({
  name,
  blurb,
  savedEmail,
  pending,
  onSubmit,
}: {
  name: string;
  blurb: string;
  savedEmail?: string;
  pending: boolean;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState(savedEmail ?? "");
  return (
    <form
      className="rounded-2xl border border-white/10 bg-[#0d1b35] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(email);
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">{name}</h3>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">Soon</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">{blurb}</p>
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Work email"
        className="mt-3 w-full rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
      >
        {savedEmail ? "Saved" : "Notify me"}
      </button>
    </form>
  );
}

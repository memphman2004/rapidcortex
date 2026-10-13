"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { safeHttpUrl } from "@/lib/rapid-iq/safe-http-url";

type WatchContact = {
  name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  organization?: string | null;
  website?: string | null;
  verification_source?: string | null;
};

type WatchProcurementDocument = {
  title: string;
  document_type: string;
  url: string;
  download_url?: string | null;
  access_type?: "public" | "registration" | "paid";
  published_at?: string | null;
  last_verified_at?: string | null;
  verification_status?: string | null;
};

type WatchProcurementDetails = {
  portal_url?: string | null;
  portal_document_id?: string | null;
  documents?: WatchProcurementDocument[];
  submission_method?: string | null;
  submission_instructions?: string | null;
  questions_deadline?: string | null;
  prebid_conference?: string | null;
  document_access_fee?: string | null;
  notes?: string | null;
  addenda_acknowledgment_required?: boolean;
  mandatory_registration?: string | null;
};

type WatchCard = {
  id: string;
  external_key: string | null;
  status: string;
  agency: { name: string | null; department: string | null; city: string | null; state: string | null };
  title: string;
  primary_vertical: string | null;
  verticals: string[];
  signal_type: string | null;
  buying_stage: string | null;
  strength: string | null;
  fit: string;
  strategy: string | null;
  funding: {
    estimated_contract_value: number | null;
    project_budget: number | null;
    grant_amount: number | null;
    annual_support: number | null;
    funding_source: string | null;
  };
  solicitation_number: string | null;
  due_date: string | null;
  opportunity_status: string | null;
  procurement_url: string | null;
  lifecycle_change: string | null;
  matched_capabilities: string[];
  competitors: string[];
  pain_points: string[];
  next_action: string | null;
  facts: string[];
  inferences: string[];
  evidence: Array<{ url: string; sourceType?: string; source_quality?: string }>;
  activities: Array<{ at: string; changeType: string; summary: string }>;
  contacts: WatchContact[];
  procurement_details: WatchProcurementDetails | null;
  priority_score: number;
  priority_label: string | null;
  watched: boolean;
  assigned_user: string | null;
  crm_record_id: string | null;
  first_discovered_at: string;
  last_updated_at: string;
  evidence_count: number;
  watch: string | null;
};

const QUERY_KEY = ["watch-inbox-signals"];

function money(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function isProcurementDoc(doc: WatchProcurementDocument): boolean {
  const t = `${doc.document_type} ${doc.title}`.toLowerCase();
  return (
    t.includes("rfp") ||
    t.includes("rfq") ||
    t.includes("ifb") ||
    t.includes("solicitation") ||
    t.includes("procurement") ||
    t.includes("bid") ||
    t.includes("addend") ||
    t.includes("proposal")
  );
}

function hasRfpAvailable(s: WatchCard): boolean {
  const docs = s.procurement_details?.documents ?? [];
  if (docs.some((d) => safeHttpUrl(d.url) && isProcurementDoc(d))) return true;
  if (safeHttpUrl(s.procurement_url) && (s.signal_type === "procurement" || s.signal_type === "rfp")) {
    return true;
  }
  return false;
}

function primaryRfpUrl(s: WatchCard): string | null {
  const docs = s.procurement_details?.documents ?? [];
  const rfp = docs.find((d) => safeHttpUrl(d.url) && isProcurementDoc(d));
  if (rfp) return safeHttpUrl(rfp.url);
  if (s.signal_type === "procurement" || s.signal_type === "rfp") {
    return safeHttpUrl(s.procurement_url);
  }
  return null;
}

function hasProcurementContact(s: WatchCard): boolean {
  return (s.contacts ?? []).some(
    (c) => Boolean(c.name?.trim()) && (Boolean(c.email?.trim()) || Boolean(c.phone?.trim())),
  );
}

function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const safe = safeHttpUrl(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "text-sky-400 hover:underline"}
    >
      {children}
    </a>
  );
}

async function fetchWatchSignals(params: URLSearchParams): Promise<WatchCard[]> {
  const res = await fetch(`/api/watch/signals?${params.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load Watch Inbox (${res.status})`);
  const data = (await res.json()) as { signals?: WatchCard[] };
  return (data.signals ?? []).map((s) => ({
    ...s,
    contacts: s.contacts ?? [],
    competitors: s.competitors ?? [],
    pain_points: s.pain_points ?? [],
    procurement_details: s.procurement_details ?? null,
    opportunity_status: s.opportunity_status ?? null,
    procurement_url: s.procurement_url ?? null,
  }));
}

async function postWatchAction(id: string, action: string, body?: Record<string, unknown>) {
  const res = await fetch(`/api/watch/signals/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${action} failed (${res.status})`);
  }
  return res.json();
}

function OverviewRow({ label, value, source }: { label: string; value: string | null | undefined; source?: "source" | "analysis" }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <dt className="min-w-[9rem] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {source === "source" ? (
          <span className="ml-1 font-normal normal-case text-emerald-500/80">(source)</span>
        ) : null}
        {source === "analysis" ? (
          <span className="ml-1 font-normal normal-case text-amber-500/80">(analysis)</span>
        ) : null}
      </dt>
      <dd className="text-sm text-slate-200">{value}</dd>
    </div>
  );
}

export function WatchInboxClient() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"inbox" | "monitoring" | "dismissed" | "qualified">("inbox");
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState("all");
  const [selected, setSelected] = useState<WatchCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (tab === "monitoring") p.set("watched", "true");
    if (tab === "dismissed") p.set("status", "dismissed");
    if (tab === "qualified") p.set("status", "pushed");
    if (vertical !== "all") p.set("vertical", vertical);
    if (search.trim()) p.set("q", search.trim());
    return p;
  }, [tab, vertical, search]);

  const listQ = useQuery({
    queryKey: [...QUERY_KEY, params.toString()],
    queryFn: () => fetchWatchSignals(params),
  });

  const signals = useMemo(() => {
    const rows = listQ.data ?? [];
    if (tab === "inbox") {
      return rows.filter((s) => s.status !== "dismissed" && s.status !== "pushed");
    }
    return rows;
  }, [listQ.data, tab]);

  const action = useMutation({
    mutationFn: async ({
      id,
      kind,
      body,
    }: {
      id: string;
      kind: "monitor" | "dismiss" | "qualify" | "assign";
      body?: Record<string, unknown>;
    }) => postWatchAction(id, kind, body),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
      setSelected(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Action failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Watch Inbox</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            ChatGPT Watch intelligence only. Signals never become CRM leads until a human qualifies
            them.
          </p>
        </div>
        <a
          href="/rc-admin/watch-ingest"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Admin ingest tester
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["inbox", "Watch Inbox"],
            ["monitoring", "Monitoring"],
            ["qualified", "Qualified"],
            ["dismissed", "Dismissed"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === id ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agency, initiative, solicitation…"
          className="min-w-[240px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        >
          <option value="all">All verticals</option>
          <option value="psap">PSAP</option>
          <option value="campus">Campus</option>
          <option value="venue">Venue</option>
          <option value="transit">Transit</option>
          <option value="law_enforcement">Law Enforcement</option>
          <option value="competitor">Competitor</option>
        </select>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {listQ.isLoading ? <p className="text-sm text-slate-500">Loading Watch signals…</p> : null}
      {listQ.isError ? (
        <p className="text-sm text-rose-400">
          {listQ.error instanceof Error ? listQ.error.message : "Failed to load"}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {signals.map((s) => {
          const rfpUrl = primaryRfpUrl(s);
          const rfpBadge = hasRfpAvailable(s);
          const contactBadge = hasProcurementContact(s);
          return (
            <article
              key={s.id}
              className="rounded-lg border border-slate-800 bg-[#0b1220] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-400">
                    {[s.agency.name, s.agency.state].filter(Boolean).join(", ")}
                  </div>
                  <h2 className="mt-1 text-base font-semibold text-white">{s.title}</h2>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <div>{s.priority_label ?? "—"}</div>
                  <div className="tabular-nums">{s.priority_score}</div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase">
                {(s.verticals.length ? s.verticals : [s.primary_vertical]).filter(Boolean).map((v) => (
                  <span key={v!} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                    {v}
                  </span>
                ))}
                {s.signal_type ? (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300">{s.signal_type}</span>
                ) : null}
                {s.buying_stage ? (
                  <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-300">
                    {s.buying_stage}
                  </span>
                ) : null}
                {s.watched ? (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">Monitoring</span>
                ) : null}
                {rfpBadge ? (
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">RFP Available</span>
                ) : null}
                {contactBadge ? (
                  <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-200">
                    Procurement Contact Available
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>
                  Strength: <span className="text-slate-200">{s.strength ?? "—"}</span>
                </div>
                <div>
                  Fit: <span className="text-slate-200">{s.fit}</span>
                </div>
                <div>
                  Strategy: <span className="text-slate-200">{s.strategy ?? "—"}</span>
                </div>
                <div>
                  Due: <span className="text-slate-200">{s.due_date ?? "—"}</span>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-xs">
                {money(s.funding.grant_amount) ? (
                  <div className="text-slate-300">
                    Grant request <span className="font-semibold">{money(s.funding.grant_amount)}</span>
                  </div>
                ) : null}
                {money(s.funding.project_budget) ? (
                  <div className="text-slate-300">
                    Project budget <span className="font-semibold">{money(s.funding.project_budget)}</span>
                  </div>
                ) : null}
                {money(s.funding.estimated_contract_value) ? (
                  <div className="text-emerald-300">
                    Estimated contract{" "}
                    <span className="font-semibold">{money(s.funding.estimated_contract_value)}</span>
                  </div>
                ) : null}
              </div>

              {s.next_action ? (
                <p className="mt-3 text-sm text-slate-300">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Next action</span>
                  <br />
                  {s.next_action}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200"
                  onClick={() => setSelected(s)}
                >
                  View intelligence
                </button>
                {rfpUrl ? (
                  <a
                    href={rfpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-sky-800/60 px-2.5 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-950/40"
                  >
                    View RFP
                  </a>
                ) : null}
                {s.status !== "pushed" && s.status !== "dismissed" ? (
                  <>
                    <button
                      type="button"
                      className="rounded-md bg-sky-700 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: s.id, kind: "qualify" })}
                    >
                      Qualify
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: s.id, kind: "monitor" })}
                    >
                      Monitor
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-rose-900/50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          id: s.id,
                          kind: "dismiss",
                          body: { reason: "Dismissed from Watch Inbox" },
                        })
                      }
                    >
                      Dismiss
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {!listQ.isLoading && signals.length === 0 ? (
        <p className="text-sm text-slate-500">No Watch signals in this view.</p>
      ) : null}

      {selected ? (
        <WatchIntelligenceModal card={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function WatchIntelligenceModal({ card, onClose }: { card: WatchCard; onClose: () => void }) {
  const details = card.procurement_details;
  const docs = details?.documents ?? [];
  const contacts = card.contacts ?? [];
  const primaryContact =
    contacts.find((c) => c.name?.trim() && (c.email?.trim() || c.phone?.trim())) ?? contacts[0];
  const portalUrl = safeHttpUrl(details?.portal_url ?? null);
  const procurementUrl = safeHttpUrl(card.procurement_url);
  const addenda = docs.filter((d) => d.document_type.toLowerCase().includes("addend"));
  const supporting = docs.filter((d) => {
    const t = d.document_type.toLowerCase();
    return !t.includes("addend") && !isProcurementDoc(d);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-700 bg-[#0b1220] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{card.title}</h3>
            <p className="mt-0.5 text-sm text-slate-300">
              {[card.agency.name, card.agency.department, card.agency.city, card.agency.state]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase">
              {card.opportunity_status ? (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                  {card.opportunity_status}
                </span>
              ) : null}
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-200">
                {card.priority_label ?? "—"} · {card.priority_score}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{card.external_key}</p>
          </div>
          <button type="button" className="text-slate-400 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="mt-5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
            Opportunity Overview
          </h4>
          <dl className="mt-2 space-y-2">
            <OverviewRow label="Solicitation #" value={card.solicitation_number} source="source" />
            <OverviewRow label="Procurement status" value={card.opportunity_status} source="source" />
            <OverviewRow label="Buying stage" value={card.buying_stage} source="analysis" />
            <OverviewRow label="Vertical" value={(card.verticals.length ? card.verticals : [card.primary_vertical]).filter(Boolean).join(", ")} source="analysis" />
            <OverviewRow label="NexCort fit" value={card.fit} source="analysis" />
            <OverviewRow
              label="Recommended strategy"
              value={card.strategy ? card.strategy.replace(/_/g, " ") : null}
              source="analysis"
            />
            <OverviewRow
              label="Estimated contract value"
              value={money(card.funding.estimated_contract_value)}
              source="source"
            />
            <OverviewRow label="Funding source" value={card.funding.funding_source} source="source" />
            <OverviewRow label="Submission deadline" value={card.due_date} source="source" />
            <OverviewRow label="Priority score" value={`${card.priority_label ?? "—"} (${card.priority_score})`} source="analysis" />
          </dl>
        </section>

        <section className="mt-5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            Procurement Documents &amp; Links
          </h4>
          {docs.length === 0 && !procurementUrl && !portalUrl ? (
            <p className="mt-2 text-sm text-slate-500">No procurement documents submitted.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {docs.map((d) => {
                const url = safeHttpUrl(d.url);
                const download = safeHttpUrl(d.download_url ?? null);
                return (
                  <li
                    key={`${d.title}-${d.url}`}
                    className="rounded-md border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <div className="text-sm font-medium text-white">{d.title}</div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                      {d.document_type}
                      {d.access_type ? ` · ${d.access_type}` : ""}
                      {d.verification_status ? ` · ${d.verification_status}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {url ? (
                        <ExternalLink
                          href={url}
                          className="rounded-md bg-sky-700 px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          {isProcurementDoc(d) ? "View Official RFP" : "View Document"}
                        </ExternalLink>
                      ) : null}
                      {download ? (
                        <ExternalLink
                          href={download}
                          className="rounded-md border border-sky-800/60 px-2.5 py-1 text-[11px] font-semibold text-sky-300"
                        >
                          {isProcurementDoc(d) ? "Download RFP" : "Download"}
                        </ExternalLink>
                      ) : null}
                      {d.access_type === "registration" || d.access_type === "paid" ? (
                        <span className="text-[11px] text-amber-300/90">
                          Login or fee may be required — use the portal link below.
                        </span>
                      ) : null}
                    </div>
                    {(d.published_at || d.last_verified_at) && (
                      <div className="mt-1 text-[11px] text-slate-500">
                        {d.published_at ? `Published ${d.published_at}` : null}
                        {d.published_at && d.last_verified_at ? " · " : null}
                        {d.last_verified_at ? `Verified ${d.last_verified_at}` : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {portalUrl ? (
              <ExternalLink
                href={portalUrl}
                className="rounded-md border border-violet-700/50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-200"
              >
                Open Procurement Portal
                {details?.portal_document_id ? ` (#${details.portal_document_id})` : ""}
              </ExternalLink>
            ) : null}
            {!docs.length && procurementUrl ? (
              <ExternalLink
                href={procurementUrl}
                className="rounded-md bg-sky-700 px-2.5 py-1.5 text-[11px] font-semibold text-white"
              >
                View Official RFP
              </ExternalLink>
            ) : null}
            {addenda.map((d) => {
              const url = safeHttpUrl(d.url);
              return url ? (
                <ExternalLink
                  key={`addenda-${d.url}`}
                  href={url}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300"
                >
                  View Addenda
                </ExternalLink>
              ) : null;
            })}
            {supporting.slice(0, 3).map((d) => {
              const url = safeHttpUrl(d.url);
              return url ? (
                <ExternalLink
                  key={`support-${d.url}`}
                  href={url}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300"
                >
                  View Supporting Documents
                </ExternalLink>
              ) : null;
            })}
          </div>
        </section>

        <section className="mt-5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
            Procurement Contact
          </h4>
          {primaryContact?.name?.trim() ? (
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              <div className="font-medium text-white">{primaryContact.name}</div>
              {primaryContact.title ? <div>{primaryContact.title}</div> : null}
              {primaryContact.department ? <div>{primaryContact.department}</div> : null}
              {primaryContact.organization ? <div>{primaryContact.organization}</div> : null}
              <div className="flex flex-wrap gap-3 pt-1">
                {primaryContact.email?.trim() ? (
                  <a
                    href={`mailto:${primaryContact.email.trim()}`}
                    className="text-sky-400 hover:underline"
                  >
                    {primaryContact.email.trim()}
                  </a>
                ) : null}
                {primaryContact.phone?.trim() ? (
                  <a
                    href={`tel:${primaryContact.phone.replace(/[^\d+]/g, "")}`}
                    className="text-sky-400 hover:underline"
                  >
                    {primaryContact.phone.trim()}
                  </a>
                ) : null}
                {safeHttpUrl(primaryContact.website) ? (
                  <ExternalLink href={primaryContact.website!}>Office website</ExternalLink>
                ) : null}
              </div>
              {primaryContact.verification_source ? (
                <div className="text-[11px] text-slate-500">
                  Source: {primaryContact.verification_source}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Procurement contact not yet verified.</p>
          )}
        </section>

        <section className="mt-5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Submission Requirements
          </h4>
          <dl className="mt-2 space-y-2">
            <OverviewRow label="Submission method" value={details?.submission_method} source="source" />
            <OverviewRow label="Solicitation #" value={card.solicitation_number} source="source" />
            <OverviewRow
              label="Portal document #"
              value={details?.portal_document_id}
              source="source"
            />
            <OverviewRow label="Proposal deadline" value={card.due_date} source="source" />
            <OverviewRow label="Questions deadline" value={details?.questions_deadline} source="source" />
            <OverviewRow label="Pre-bid conference" value={details?.prebid_conference} source="source" />
            <OverviewRow
              label="Mandatory registration"
              value={details?.mandatory_registration}
              source="source"
            />
            <OverviewRow
              label="Document access fee"
              value={details?.document_access_fee}
              source="source"
            />
            <OverviewRow
              label="Addenda acknowledgment"
              value={
                details?.addenda_acknowledgment_required == null
                  ? null
                  : details.addenda_acknowledgment_required
                    ? "Required"
                    : "Not required"
              }
              source="source"
            />
          </dl>
          {details?.submission_instructions ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
              {details.submission_instructions}
            </p>
          ) : null}
          {portalUrl ? (
            <p className="mt-2 text-sm">
              Submission portal: <ExternalLink href={portalUrl}>{portalUrl}</ExternalLink>
            </p>
          ) : null}
          {details?.notes ? (
            <p className="mt-2 text-sm text-slate-400">{details.notes}</p>
          ) : null}
          {!details?.submission_method &&
          !details?.submission_instructions &&
          !details?.questions_deadline &&
          !card.due_date ? (
            <p className="mt-2 text-sm text-slate-500">No submission requirements documented yet.</p>
          ) : null}
        </section>

        <section className="mt-5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
            Recommended NexCort iQ Action
          </h4>
          {card.next_action ? (
            <p className="mt-2 text-sm text-slate-200">{card.next_action}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No next action submitted.</p>
          )}
          <dl className="mt-3 space-y-2">
            <OverviewRow
              label="Suggested outreach"
              value={primaryContact?.title || (card.strategy === "partner" ? "Partner / prime" : "Procurement / IT")}
              source="analysis"
            />
            <OverviewRow
              label="Partner opportunity"
              value={card.strategy === "partner" ? "Pursue via CAD/NG911 prime partner" : null}
              source="analysis"
            />
            <OverviewRow
              label="Matched capabilities"
              value={card.matched_capabilities.length ? card.matched_capabilities.join(", ") : null}
              source="analysis"
            />
            <OverviewRow
              label="Incumbent / competitors"
              value={card.competitors.length ? card.competitors.join(", ") : null}
              source="source"
            />
            <OverviewRow label="Important dates" value={[card.due_date && `Proposal due ${card.due_date}`, details?.questions_deadline && `Questions due ${details.questions_deadline}`].filter(Boolean).join(" · ") || null} source="source" />
            <OverviewRow
              label="Follow-up priority"
              value={card.priority_label ? `${card.priority_label} (${card.priority_score})` : null}
              source="analysis"
            />
          </dl>
        </section>

        <section className="mt-5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            Verified facts
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {(card.facts.length ? card.facts : ["No facts submitted."]).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section className="mt-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
            NexCort analysis
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {(card.inferences.length ? card.inferences : ["No inferences submitted."]).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section className="mt-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Lifecycle
          </h4>
          <ol className="mt-2 space-y-2 border-l border-slate-700 pl-3">
            {(card.activities ?? []).map((a) => (
              <li key={`${a.at}-${a.changeType}`} className="text-sm text-slate-300">
                <div className="text-[10px] text-slate-500">{a.at.slice(0, 10)}</div>
                <div className="font-medium text-slate-200">{a.changeType.replace(/_/g, " ")}</div>
                <div className="text-slate-400">{a.summary}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Evidence
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            {(card.evidence ?? []).map((e) => {
              const url = safeHttpUrl(e.url);
              return url ? (
                <li key={e.url}>
                  <ExternalLink href={url}>{e.url}</ExternalLink>
                </li>
              ) : (
                <li key={e.url} className="text-slate-500">
                  Invalid evidence URL omitted
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  PSAP_OUTREACH_STATUSES,
  PSAP_OUTREACH_STATUS_CONFIG,
  type AddPsapActivityRequest,
  type PatchPsapProspectBody,
  type PsapActivity,
  type PsapOutreachStatus,
  type PsapProspect,
  type PsapProspectContact,
} from "rapid-cortex-shared";
import { AlertCircle, CheckCircle, Copy, Mail, Phone, Sparkles, X } from "lucide-react";
import { addPsapActivity, enrichPsapContacts, patchPsapProspect } from "@/lib/psap/psap-api";
import { PsapStatusBadge } from "./PsapStatusBadge";

type Tab = "details" | "activity" | "mailing";
type ActivityType = AddPsapActivityRequest["type"];

type Props = {
  prospect: PsapProspect;
  onClose: () => void;
  onUpdated: (prospect: PsapProspect) => void;
};

const ACTIVITY_TYPES: { type: Exclude<ActivityType, "stage_change">; label: string }[] = [
  { type: "call", label: "Call" },
  { type: "email", label: "Email" },
  { type: "mail", label: "Mail" },
  { type: "note", label: "Note" },
  { type: "demo", label: "Demo" },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-[#334155]">
      <span>{title}</span>
      <div className="flex-1 border-b border-[rgba(255,255,255,0.04)]" />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={() => {
          /* parent saves on blur via pending patch */
        }}
        className={`w-full rounded border border-[#1e2130] bg-[#0a0b0f] px-2.5 py-1.5 text-sm text-slate-200 focus:border-violet-500/40 focus:outline-none ${
          readOnly ? "opacity-70" : ""
        }`}
      />
    </label>
  );
}

function formatActivityTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const ROLE_TIER_STYLE: Record<PsapProspectContact["roleTier"], string> = {
  primary: "bg-sky-900/50 text-sky-300",
  secondary: "bg-slate-800 text-slate-300",
  procurement: "bg-amber-900/40 text-amber-300",
  executive: "bg-violet-900/40 text-violet-300",
};

function EnrichedContactCard({ contact }: { contact: PsapProspectContact }) {
  const sourceLabel =
    contact.source === "hunter"
      ? "Hunter.io"
      : contact.source === "apollo"
        ? "Apollo"
        : contact.source === "directory"
          ? "Directory"
          : "Manual";
  return (
    <div className="mb-2 rounded border border-slate-800 bg-slate-900/50 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-200">
            {contact.name ?? "Name not found"}
          </div>
          <div className="text-[10px] text-slate-500">{contact.title}</div>
          <div className="mt-0.5 flex items-center gap-1">
            {contact.verificationStatus === "verified" ? (
              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                <CheckCircle size={9} /> VERIFIED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400">
                <AlertCircle size={9} /> PREDICTED
              </span>
            )}
            <span className="text-[9px] text-slate-600">via {sourceLabel}</span>
          </div>
        </div>
        <span
          className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${ROLE_TIER_STYLE[contact.roleTier]}`}
        >
          {contact.roleTier}
        </span>
      </div>
      {contact.email && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
          <Mail size={9} className="text-slate-600" />
          <a href={`mailto:${contact.email}`} className="text-slate-400 hover:text-sky-400">
            {contact.email}
          </a>
          {contact.emailVerified ? (
            <CheckCircle size={9} className="text-emerald-400" />
          ) : (
            <AlertCircle size={9} className="text-amber-400" />
          )}
        </div>
      )}
      {contact.phone && (
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
          <Phone size={9} className="text-slate-600" />
          <span className="text-slate-400">{contact.phone}</span>
        </div>
      )}
    </div>
  );
}

export function PsapDetailPanel({ prospect, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [draft, setDraft] = useState(prospect);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichNotice, setEnrichNotice] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<Exclude<ActivityType, "stage_change">>("note");
  const [activityText, setActivityText] = useState("");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft(prospect);
    setError(null);
    setEnrichNotice(null);
  }, [prospect]);

  async function savePatch(patch: PatchPsapProspectBody) {
    setSaving(true);
    setError(null);
    try {
      const updated = await patchPsapProspect(prospect.psapId, patch);
      onUpdated(updated);
      setDraft(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnrichContacts() {
    setEnriching(true);
    setError(null);
    setEnrichNotice(null);
    try {
      const result = await enrichPsapContacts(prospect.psapId);
      onUpdated(result.prospect);
      setDraft(result.prospect);
      if (result.count === 0) {
        const domains = result.changeLog?.domains ?? result.domains;
        const domainText = domains?.filter(Boolean).slice(0, 5).join(", ");
        const reason = result.changeLog?.reason ?? "";
        const parts: string[] = [];
        if (reason.includes("rate_limited")) parts.push("Hunter.io rate-limited this request.");
        if (reason.includes("invalid_api_key")) parts.push("Apollo API key was rejected.");
        if (reason.includes("no_api_key")) parts.push("Hunter.io / Apollo keys are not configured.");
        if (reason === "timestamp_only") {
          parts.push("No contacts found; only the last-enriched timestamp was updated.");
        } else if (parts.length === 0) {
          parts.push(reason ? `No contacts saved (${reason}).` : "No contacts found.");
        }
        const reasonText = parts.join(" ");
        setEnrichNotice(domainText ? `${reasonText} Searched ${domainText}.` : reasonText);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  async function postActivity() {
    const description = activityText.trim();
    if (!description) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await addPsapActivity(prospect.psapId, {
        type: activityType,
        description,
      });
      onUpdated(updated);
      setDraft(updated);
      setActivityText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activity failed");
    } finally {
      setSaving(false);
    }
  }

  function copyMailingLabel() {
    const attn = draft.primaryContactName?.trim() || "Communications Director";
    const lines = [
      attn,
      draft.psapName,
      draft.mailingAddress?.streetAddress?.trim() || "",
      [
        draft.mailingAddress?.city || draft.city,
        draft.mailingAddress?.state || draft.state,
        draft.mailingAddress?.zip || "",
      ]
        .filter(Boolean)
        .join(" "),
    ].filter(Boolean);
    void navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopyMsg("Copied");
      setTimeout(() => setCopyMsg(null), 1500);
    });
  }

  const enrichmentLabel = !draft.mailingAddress?.streetAddress
    ? "No address yet"
    : draft.mailingAddress.verified
      ? "Manually verified"
      : draft.mailingAddress.source === "aws_location"
        ? "Address from AWS Location — not verified"
        : draft.mailingAddress.source === "nominatim"
          ? "Address from Nominatim — not verified"
          : "Address present — not verified";

  /** PATCH payload: editable fields only; mark as manual edit. */
  function mailingPatchFromDraft(): NonNullable<PatchPsapProspectBody["mailingAddress"]> {
    const m = draft.mailingAddress;
    return {
      streetAddress: m?.streetAddress?.trim() || undefined,
      city: (m?.city || draft.city).trim(),
      county: (m?.county || draft.county).trim(),
      state: (m?.state || draft.state).trim().toUpperCase().slice(0, 2),
      zip: m?.zip?.trim() || undefined,
      verified: Boolean(m?.verified),
      source: "manual",
    };
  }

  const activities: PsapActivity[] = [...(draft.activities ?? [])].sort((a, b) =>
    b.performedAt.localeCompare(a.performedAt),
  );

  return (
    <aside className="flex h-full w-full max-w-md flex-col border-l border-[#1e2130] bg-[#0f1117]">
      <div className="flex items-start justify-between gap-2 border-b border-[#1e2130] px-4 py-3">
        <div className="min-w-0">
          <PsapStatusBadge status={draft.outreachStatus} size="md" />
          <h2 className="mt-2 truncate text-base font-semibold text-slate-100">{draft.psapName}</h2>
          <p className="text-xs text-slate-500">
            {draft.city}, {draft.state} · {draft.phone}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:bg-[#13161e] hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex border-b border-[#1e2130]">
        {(["details", "activity", "mailing"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide ${
              tab === t
                ? "border-b-2 border-violet-400 text-violet-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <p className="mb-3 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-300">
            {error}
          </p>
        )}

        {tab === "details" && (
          <div className="space-y-4">
            <SectionHeader title="Outreach" />
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </span>
              <select
                value={draft.outreachStatus}
                onChange={(e) => {
                  const outreachStatus = e.target.value as PsapOutreachStatus;
                  setDraft((d) => ({ ...d, outreachStatus }));
                  void savePatch({ outreachStatus });
                }}
                className="w-full rounded border border-[#1e2130] bg-[#0a0b0f] px-2.5 py-1.5 text-sm text-slate-200"
              >
                {PSAP_OUTREACH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PSAP_OUTREACH_STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Assigned To"
              value={draft.assignedToName ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, assignedToName: v }))}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void savePatch({
                  assignedToName: draft.assignedToName?.trim() || undefined,
                })
              }
              className="text-xs text-violet-300 hover:underline disabled:opacity-50"
            >
              Save assignment
            </button>
            <Field
              label="Estimated Value (cents)"
              type="number"
              value={draft.estimatedValue != null ? String(draft.estimatedValue) : ""}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  estimatedValue: v === "" ? undefined : Number(v),
                }))
              }
            />
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void savePatch({
                  estimatedValue:
                    draft.estimatedValue != null && !Number.isNaN(draft.estimatedValue)
                      ? draft.estimatedValue
                      : undefined,
                })
              }
              className="text-xs text-violet-300 hover:underline disabled:opacity-50"
            >
              Save value
            </button>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Contacts
              </h3>
              <button
                type="button"
                onClick={() => void handleEnrichContacts()}
                disabled={enriching || saving}
                className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                <Sparkles size={10} />
                {enriching ? "Finding contacts…" : "Enrich Contacts"}
              </button>
            </div>
            {draft.lastEnrichedAt && (
              <div className="mb-2 text-[9px] text-slate-600">
                Last enriched {formatTimeAgo(draft.lastEnrichedAt)}
              </div>
            )}
            {enrichNotice && (
              <p className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                {enrichNotice}
              </p>
            )}
            {(draft.contacts?.length ?? 0) > 0 ? (
              <div className="mb-3">
                {draft.contacts!.map((c) => (
                  <EnrichedContactCard key={c.contactId} contact={c} />
                ))}
              </div>
            ) : (
              <p className="mb-3 text-[11px] text-slate-600">
                No enriched contacts yet — click Enrich Contacts to run Hunter.io + Apollo.
              </p>
            )}

            <SectionHeader title="Primary Contact (manual)" />
            <Field
              label="Name"
              value={draft.primaryContactName ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, primaryContactName: v }))}
            />
            <Field
              label="Title"
              value={draft.primaryContactTitle ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, primaryContactTitle: v }))}
            />
            <Field
              label="Email"
              value={draft.primaryContactEmail ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, primaryContactEmail: v }))}
            />
            <Field
              label="Phone"
              value={draft.primaryContactPhone ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, primaryContactPhone: v }))}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void savePatch({
                  primaryContactName: draft.primaryContactName,
                  primaryContactTitle: draft.primaryContactTitle,
                  primaryContactEmail: draft.primaryContactEmail,
                  primaryContactPhone: draft.primaryContactPhone,
                })
              }
              className="rounded border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200 disabled:opacity-50"
            >
              Save contact
            </button>

            <SectionHeader title="PSAP Info" />
            <Field label="PSAP Name" value={draft.psapName} readOnly />
            <div className="grid grid-cols-2 gap-2">
              <Field label="County" value={draft.county} readOnly />
              <Field label="City" value={draft.city} readOnly />
              <Field label="State" value={draft.state} readOnly />
              <Field label="FIPS" value={draft.fips} readOnly />
            </div>
            <Field label="Phone" value={draft.phone} readOnly />
            <Field
              label="Website (optional)"
              value={draft.website ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, website: v || undefined }))}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePatch({ website: draft.website?.trim() || "" })}
              className="text-xs text-violet-300 hover:underline disabled:opacity-50"
            >
              Save website
            </button>

            <SectionHeader title="Notes / Next Action" />
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </span>
              <textarea
                value={draft.notes ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                onBlur={() => void savePatch({ notes: draft.notes })}
                rows={4}
                className="w-full rounded border border-[#1e2130] bg-[#0a0b0f] px-2.5 py-1.5 text-sm text-slate-200 focus:border-violet-500/40 focus:outline-none"
              />
            </label>
            <Field
              label="Next Action Date"
              type="date"
              value={draft.nextActionDate?.slice(0, 10) ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, nextActionDate: v || undefined }))}
            />
            <Field
              label="Next Action Note"
              value={draft.nextActionNote ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, nextActionNote: v }))}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void savePatch({
                  nextActionDate: draft.nextActionDate,
                  nextActionNote: draft.nextActionNote,
                })
              }
              className="text-xs text-violet-300 hover:underline disabled:opacity-50"
            >
              Save next action
            </button>
          </div>
        )}

        {tab === "activity" && (
          <div className="space-y-4">
            <div className="space-y-2 rounded border border-[#1e2130] bg-[#0a0b0f] p-3">
              <div className="flex flex-wrap gap-1">
                {ACTIVITY_TYPES.map((a) => (
                  <button
                    key={a.type}
                    type="button"
                    onClick={() => setActivityType(a.type)}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      activityType === a.type
                        ? "bg-violet-500/20 text-violet-200"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <textarea
                value={activityText}
                onChange={(e) => setActivityText(e.target.value)}
                rows={3}
                placeholder="Log outreach…"
                className="w-full rounded border border-[#1e2130] bg-[#0f1117] px-2.5 py-1.5 text-sm text-slate-200 focus:border-violet-500/40 focus:outline-none"
              />
              <button
                type="button"
                disabled={saving || !activityText.trim()}
                onClick={() => void postActivity()}
                className="rounded border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200 disabled:opacity-50"
              >
                Post
              </button>
            </div>

            <ul className="space-y-2">
              {activities.length === 0 && (
                <li className="text-sm text-slate-500">No activity yet.</li>
              )}
              {activities.map((a) => (
                <li
                  key={a.activityId}
                  className="rounded border border-[#1e2130] bg-[#0a0b0f] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-violet-300">
                      {a.type}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {formatActivityTime(a.performedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{a.description}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{a.performedByName}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "mailing" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">{enrichmentLabel}</p>
            <Field
              label="Street Address"
              value={draft.mailingAddress?.streetAddress ?? ""}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  mailingAddress: {
                    ...d.mailingAddress,
                    city: d.mailingAddress?.city ?? d.city,
                    county: d.mailingAddress?.county ?? d.county,
                    state: d.mailingAddress?.state ?? d.state,
                    verified: d.mailingAddress?.verified ?? false,
                    streetAddress: v,
                    source: "manual",
                  },
                }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="City"
                value={draft.mailingAddress?.city ?? draft.city}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    mailingAddress: {
                      ...d.mailingAddress,
                      county: d.mailingAddress?.county ?? d.county,
                      state: d.mailingAddress?.state ?? d.state,
                      verified: d.mailingAddress?.verified ?? false,
                      city: v,
                      source: "manual",
                    },
                  }))
                }
              />
              <Field
                label="County"
                value={draft.mailingAddress?.county ?? draft.county}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    mailingAddress: {
                      ...d.mailingAddress,
                      city: d.mailingAddress?.city ?? d.city,
                      state: d.mailingAddress?.state ?? d.state,
                      verified: d.mailingAddress?.verified ?? false,
                      county: v,
                      source: "manual",
                    },
                  }))
                }
              />
              <Field
                label="State"
                value={draft.mailingAddress?.state ?? draft.state}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    mailingAddress: {
                      ...d.mailingAddress,
                      city: d.mailingAddress?.city ?? d.city,
                      county: d.mailingAddress?.county ?? d.county,
                      verified: d.mailingAddress?.verified ?? false,
                      state: v,
                      source: "manual",
                    },
                  }))
                }
              />
              <Field
                label="ZIP"
                value={draft.mailingAddress?.zip ?? ""}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    mailingAddress: {
                      ...d.mailingAddress,
                      city: d.mailingAddress?.city ?? d.city,
                      county: d.mailingAddress?.county ?? d.county,
                      state: d.mailingAddress?.state ?? d.state,
                      verified: d.mailingAddress?.verified ?? false,
                      zip: v,
                      source: "manual",
                    },
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={Boolean(draft.mailingAddress?.verified)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    mailingAddress: {
                      ...d.mailingAddress,
                      city: d.mailingAddress?.city ?? d.city,
                      county: d.mailingAddress?.county ?? d.county,
                      state: d.mailingAddress?.state ?? d.state,
                      verified: e.target.checked,
                      source: "manual",
                    },
                  }))
                }
              />
              Verified for mail campaign
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void savePatch({
                    mailingAddress: mailingPatchFromDraft(),
                  })
                }
                className="rounded border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200 disabled:opacity-50"
              >
                Save address
              </button>
              <button
                type="button"
                onClick={copyMailingLabel}
                className="inline-flex items-center gap-1 rounded border border-[#1e2130] px-2.5 py-1 text-xs text-slate-300 hover:bg-[#13161e]"
              >
                <Copy className="h-3 w-3" />
                {copyMsg ?? "Copy Mailing Label"}
              </button>
            </div>
            <div className="rounded border border-[#1e2130] bg-[#0a0b0f] p-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-slate-600">Map preview</p>
              <p className="mt-1 font-mono text-xs text-slate-400">
                {draft.latitude.toFixed(4)}, {draft.longitude.toFixed(4)}
              </p>
            </div>
          </div>
        )}
      </div>

      {saving && (
        <div className="border-t border-[#1e2130] px-4 py-1.5 text-[11px] text-slate-500">
          Saving…
        </div>
      )}
    </aside>
  );
}

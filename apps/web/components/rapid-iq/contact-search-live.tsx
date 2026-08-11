"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Mail,
  Phone,
  Search,
  Sparkles,
} from "lucide-react";
import type { MentionedEntity, RapidIqContact } from "@/lib/rapid-iq/types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ContactCard({ contact }: { contact: RapidIqContact }) {
  const matchDot: Record<RapidIqContact["matchType"], string> = {
    exact: "bg-emerald-400",
    related: "bg-sky-400",
    mentioned: "bg-amber-400",
    none: "bg-slate-600",
  };
  const dotClass = matchDot[contact.matchType];

  return (
    <div className="mb-2 flex items-start gap-3 rounded border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400">
        {contact.name ? initials(contact.name) : "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">{contact.name ?? "Unknown"}</span>
          {contact.matchedOn && (
            <span className="flex items-center gap-1 text-[9px]">
              <div className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
              <span className="text-slate-500">Matched on</span>
              <span className="rounded bg-slate-800 px-1 py-0.5 text-[8px] font-bold text-slate-300">
                {contact.matchedOn}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="font-semibold uppercase">{contact.title}</span>
          {contact.sourceCount > 0 && (
            <span className="text-slate-700">↔ {contact.sourceCount} SOURCES</span>
          )}
        </div>
        {contact.email && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
            <Mail size={9} className="shrink-0 text-slate-600" />
            <a href={`mailto:${contact.email}`} className="text-slate-400 transition-colors hover:text-sky-400">
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
            <Phone size={9} className="shrink-0 text-slate-600" />
            <span className="text-slate-400">{contact.phone}</span>
          </div>
        )}
        {contact.sourceUrl && (
          <a
            href={contact.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[10px] text-sky-400 hover:underline"
          >
            Official Profile →
          </a>
        )}
      </div>
    </div>
  );
}

type Props = {
  contacts: RapidIqContact[];
  mentioned: MentionedEntity[];
};

export function ContactSearchLive({ contacts, mentioned }: Props) {
  const [filter, setFilter] = useState("");
  const isSearching = contacts.some((c) => c.verificationStatus === "unverified");
  const foundCount = contacts.filter((c) => c.name).length;
  const personaChips = [...new Set(contacts.map((c) => c.matchedOn).filter(Boolean))] as string[];

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const named = contacts.filter((c) => c.name);
    if (!q) return named;
    return named.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q),
    );
  }, [contacts, filter]);

  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Reach out to your target personas
      </div>

      <div className="mb-3 flex items-center gap-2">
        {isSearching ? (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Loader2 size={10} className="animate-spin" /> Still searching for matches
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <CheckCircle size={10} className="text-emerald-400" /> Search complete
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-600">
          {foundCount} contact{foundCount !== 1 ? "s" : ""} so far…
        </span>
      </div>

      {foundCount > 0 && (
        <div className="mb-2 flex items-center gap-3 text-[9px] font-bold">
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Exact match
          </span>
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Related
          </span>
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Mentioned
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />
            No match
          </span>
        </div>
      )}

      {personaChips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {personaChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] font-bold text-slate-500"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="relative mb-3">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, title, email, or phone…"
          className="w-full rounded border border-slate-800 bg-slate-900/50 py-1.5 pl-8 pr-2 text-[11px] text-slate-300 outline-none focus:border-sky-500"
        />
      </div>

      {foundCount === 0 && isSearching && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles size={20} className="mb-2 text-amber-400/60" />
          <div className="mb-1 text-xs font-semibold text-slate-400">
            Finding the right people for this signal
          </div>
          <div className="text-[10px] text-slate-600">
            Searching the agency database, public records, and the signal summary…
          </div>
        </div>
      )}

      {filtered.map((contact) => (
        <ContactCard key={contact.contactId} contact={contact} />
      ))}

      {mentioned.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            Also mentioned in this signal
          </div>
          {mentioned.map((entity, i) => (
            <div
              key={i}
              className="flex items-center gap-2 border-b border-slate-800/60 py-1.5 last:border-0"
            >
              <span className="flex-1 text-[11px] text-slate-400">
                {entity.name}
                {entity.role && <span className="text-slate-600">, {entity.role}</span>}
              </span>
              <span className="text-slate-700">—</span>
              {entity.status === "searching" ? (
                <span className="flex items-center gap-1 text-[10px] text-slate-600">
                  <Loader2 size={9} className="animate-spin" /> Searching…
                </span>
              ) : entity.status === "not_found" ? (
                <span className="text-[10px] text-slate-700">Not found</span>
              ) : (
                <span className="text-[10px] text-sky-400">
                  {(() => {
                    const linked = contacts.find((c) => c.contactId === entity.linkedContactId);
                    return linked?.name ?? linked?.title ?? entity.name ?? "View contact";
                  })()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { AlertCircle, CheckCircle, ExternalLink, Mail, Pencil, Phone } from "lucide-react";
import type { ContactPerson, OutreachStatus } from "rapid-cortex-shared";
import { formatTimeAgo } from "@/lib/contacts/api";

const OUTREACH_STATUS: Record<OutreachStatus, { label: string; cls: string }> = {
  not_contacted: { label: "Not Contacted", cls: "text-slate-600" },
  contacted: { label: "Contacted", cls: "text-amber-400" },
  replied: { label: "Replied", cls: "text-sky-400" },
  meeting_set: { label: "Meeting Set", cls: "text-emerald-400" },
  closed: { label: "Closed", cls: "text-green-400" },
};

type Props = {
  contact: ContactPerson;
  onEdit: (contact: ContactPerson) => void;
};

export function ContactCard({ contact, onEdit }: Props) {
  const status = OUTREACH_STATUS[contact.outreachStatus];
  return (
    <div className="mb-2 rounded border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400">
            {(contact.firstName[0] ?? "").toUpperCase()}
            {(contact.lastName[0] ?? "").toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">
              {contact.firstName} {contact.lastName}
            </div>
            <div className="text-[10px] text-slate-500">{contact.title ?? "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold ${status.cls}`}>{status.label}</span>
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="text-slate-600 hover:text-slate-400"
            aria-label="Edit contact"
          >
            <Pencil size={12} />
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {contact.email && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <Mail size={9} className="shrink-0 text-slate-600" />
            <a href={`mailto:${contact.email}`} className="text-slate-400 hover:text-sky-400">
              {contact.email}
            </a>
            {contact.emailVerified ? (
              <CheckCircle size={9} className="text-emerald-400" />
            ) : (
              <AlertCircle size={9} className="text-amber-400/70" />
            )}
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <Phone size={9} className="shrink-0 text-slate-600" />
            <span className="text-slate-400">{contact.phone}</span>
          </div>
        )}
        {contact.linkedInUrl && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <ExternalLink size={9} className="shrink-0 text-slate-600" />
            <a
              href={contact.linkedInUrl}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-sky-400"
            >
              LinkedIn Profile
            </a>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] text-slate-600">
        <span>via {contact.source}</span>
        {contact.lastContactedAt && (
          <span>Last contact: {formatTimeAgo(contact.lastContactedAt)}</span>
        )}
      </div>
    </div>
  );
}

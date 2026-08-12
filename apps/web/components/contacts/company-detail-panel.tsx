"use client";

import Link from "next/link";
import type { ContactCompany, ContactPerson } from "rapid-cortex-shared";
import { RELATIONSHIP_COLORS } from "@/lib/contacts/api";
import { ContactCard } from "./contact-card";

type Props = {
  company: ContactCompany | null;
  contacts: ContactPerson[];
  loading: boolean;
  onAddContact: () => void;
  onEditContact: (c: ContactPerson) => void;
};

export function CompanyDetailPanel({
  company,
  contacts,
  loading,
  onAddContact,
  onEditContact,
}: Props) {
  if (!company) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500">
        Select a company to view contacts
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{company.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${RELATIONSHIP_COLORS[company.relationshipType]}`}
            >
              {company.relationshipType}
            </span>
            <span>{company.industry ?? "—"}</span>
            {company.hq && <span>· {company.hq}</span>}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline"
              >
                {company.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onAddContact}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500"
        >
          + Add Contact
        </button>
      </div>

      {company.notes && (
        <section className="mt-4 rounded border border-slate-800 bg-slate-900/40 p-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Notes</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{company.notes}</p>
        </section>
      )}

      <section className="mt-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Contacts ({contacts.length})
        </h3>
        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="text-xs text-slate-500">No contacts yet.</p>
          ) : (
            contacts.map((c) => (
              <ContactCard key={c.contactId} contact={c} onEdit={onEditContact} />
            ))
          )}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Linked Signals ({company.linkedSignalIds.length})
        </h3>
        {company.linkedSignalIds.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No Rapid IQ signals linked yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-sky-400">
            {company.linkedSignalIds.map((id) => (
              <li key={id}>
                <Link href={`/rc-admin/rapid-iq?opportunity=${encodeURIComponent(id)}`}>
                  {id}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

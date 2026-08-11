"use client";

import type { RapidIqContact } from "@/lib/rapid-iq/types";

const BUYING_ROLES = [
  {
    role: "Champion",
    description: "Drives internal adoption",
    titles: [
      "911 Director",
      "E911 Director",
      "ECC Director",
      "PSAP Director",
      "Emergency Communications Director",
    ],
    foundClass: "border-sky-500/30 bg-sky-500/5",
    labelClass: "text-sky-400",
  },
  {
    role: "Economic Buyer",
    description: "Controls the budget",
    titles: [
      "County Manager",
      "City Manager",
      "County Administrator",
      "Mayor",
      "County Commissioner",
      "Finance Director",
    ],
    foundClass: "border-emerald-500/30 bg-emerald-500/5",
    labelClass: "text-emerald-400",
  },
  {
    role: "Technical Evaluator",
    description: "Validates the integration",
    titles: [
      "IT Director",
      "CIO",
      "Chief Information Officer",
      "Technology Director",
      "Systems Administrator",
    ],
    foundClass: "border-violet-500/30 bg-violet-500/5",
    labelClass: "text-violet-400",
  },
  {
    role: "Procurement",
    description: "Controls the contract",
    titles: [
      "Purchasing Director",
      "Procurement Officer",
      "Contracts Manager",
      "Procurement Manager",
    ],
    foundClass: "border-amber-500/30 bg-amber-500/5",
    labelClass: "text-amber-400",
  },
] as const;

function findContactForRole(contacts: RapidIqContact[], role: (typeof BUYING_ROLES)[number]) {
  return contacts.find((c) =>
    role.titles.some((t) => c.title?.toLowerCase().includes(t.toLowerCase())),
  );
}

export function BuyingCommitteeMap({ contacts }: { contacts: RapidIqContact[] }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Buying Committee
      </div>
      <div className="grid grid-cols-2 gap-2">
        {BUYING_ROLES.map((role) => {
          const contact = findContactForRole(contacts, role);
          return (
            <div
              key={role.role}
              className={`rounded border p-2.5 ${
                contact ? role.foundClass : "border-slate-800 bg-slate-900/30"
              }`}
            >
              <div
                className={`mb-1 text-[9px] font-bold uppercase tracking-wide ${
                  contact ? role.labelClass : "text-slate-600"
                }`}
              >
                {role.role}
              </div>
              {contact ? (
                <>
                  <div className="text-[11px] font-semibold text-slate-200">
                    {contact.name ?? "Found"}
                  </div>
                  <div className="text-[10px] text-slate-500">{contact.title}</div>
                  {contact.email && (
                    <div className="mt-0.5 truncate text-[9px] text-slate-600">{contact.email}</div>
                  )}
                </>
              ) : (
                <div className="text-[10px] text-slate-600">{role.description}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

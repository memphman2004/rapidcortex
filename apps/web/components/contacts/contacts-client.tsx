"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ContactCompany,
  ContactPerson,
  ContactVertical,
  CreateCompanyBody,
  CreateContactBody,
  RelationshipType,
} from "rapid-cortex-shared";
import {
  createCompany,
  createContact,
  listCompanies,
  listCompanyContacts,
  updateContact,
} from "@/lib/contacts/api";
import { AddCompanyModal } from "./add-company-modal";
import { AddContactModal } from "./add-contact-modal";
import { CompanyCard } from "./company-card";
import { CompanyDetailPanel } from "./company-detail-panel";
import { ContactFilterBar } from "./contact-filter-bar";

type Props = {
  initialCompanyId?: string | null;
};

export function ContactsClient({ initialCompanyId = null }: Props) {
  const [companies, setCompanies] = useState<ContactCompany[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialCompanyId);
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [search, setSearch] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType | "all">("all");
  const [vertical, setVertical] = useState<ContactVertical | "all">("all");
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactPerson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => companies.find((c) => c.companyId === selectedId) ?? null,
    [companies, selectedId],
  );

  const refreshCompanies = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const items = await listCompanies({
        q: search.trim() || undefined,
        relationshipType,
        vertical,
      });
      setCompanies(items);
      if (selectedId && !items.some((c) => c.companyId === selectedId)) {
        setSelectedId(items[0]?.companyId ?? null);
      } else if (!selectedId && items[0]) {
        setSelectedId(items[0].companyId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load companies");
    } finally {
      setLoadingList(false);
    }
  }, [search, relationshipType, vertical, selectedId]);

  useEffect(() => {
    const t = setTimeout(() => void refreshCompanies(), 200);
    return () => clearTimeout(t);
  }, [refreshCompanies]);

  useEffect(() => {
    if (!selectedId) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    setLoadingContacts(true);
    void listCompanyContacts(selectedId)
      .then((items) => {
        if (!cancelled) setContacts(items);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingContacts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleCreateCompany(body: CreateCompanyBody) {
    const item = await createCompany(body);
    await refreshCompanies();
    setSelectedId(item.companyId);
  }

  async function handleCreateContact(body: CreateContactBody) {
    if (!selectedId) return;
    if (editingContact) {
      await updateContact(editingContact.contactId, body);
    } else {
      await createContact(selectedId, body);
    }
    const items = await listCompanyContacts(selectedId);
    setContacts(items);
    await refreshCompanies();
    setEditingContact(null);
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#050c1a]">
      <ContactFilterBar
        search={search}
        onSearchChange={setSearch}
        relationshipType={relationshipType}
        onTypeChange={setRelationshipType}
        vertical={vertical}
        onVerticalChange={setVertical}
        onAddCompany={() => setAddCompanyOpen(true)}
      />
      {error && (
        <div className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(280px,420px)_1fr]">
        <div className="min-h-0 overflow-y-auto border-r border-slate-800">
          {loadingList ? (
            <p className="p-4 text-xs text-slate-500">Loading companies…</p>
          ) : companies.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No companies yet. Add one to get started.</p>
          ) : (
            companies.map((c) => (
              <CompanyCard
                key={c.companyId}
                company={c}
                selected={c.companyId === selectedId}
                onSelect={() => setSelectedId(c.companyId)}
              />
            ))
          )}
        </div>
        <div className="min-h-0 border-t border-slate-800 md:border-t-0">
          <CompanyDetailPanel
            company={selected}
            contacts={contacts}
            loading={loadingContacts}
            onAddContact={() => {
              setEditingContact(null);
              setAddContactOpen(true);
            }}
            onEditContact={(c) => {
              setEditingContact(c);
              setAddContactOpen(true);
            }}
          />
        </div>
      </div>

      <AddCompanyModal
        open={addCompanyOpen}
        onClose={() => setAddCompanyOpen(false)}
        onSubmit={handleCreateCompany}
      />
      <AddContactModal
        open={addContactOpen}
        companyName={selected?.name ?? ""}
        initial={editingContact}
        onClose={() => {
          setAddContactOpen(false);
          setEditingContact(null);
        }}
        onSubmit={handleCreateContact}
      />
    </div>
  );
}

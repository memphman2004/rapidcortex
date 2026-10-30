"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { bizCardFetch } from "@/lib/business-cards/client";
import { normalizeWebsite } from "@/lib/business-cards/form";
import { existingNfcToolHref } from "@/lib/business-cards/nfc-href";
import type { ApiProfile } from "@/lib/business-cards/form";
import { CardEditor } from "./card-editor";
import { WriteNfcButton } from "./write-nfc-button";

type NfcItem = {
  cardId: string;
  tagType: string;
  status: string;
  permanentUrl: string;
  version: number;
  assignedProfileId?: string;
};

export function AdminDirectory() {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const statusFilter = search.get("status") ?? "";
  const [items, setItems] = useState<ApiProfile[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const base = pathname.replace(/\/admin\/business-cards.*/, "");

  useEffect(() => {
    void bizCardFetch<{ items: ApiProfile[] }>("/api/admin/business-cards")
      .then((page) => setItems(page.items))
      .catch((error: Error) => setMessage(error.message));
  }, []);

  const shown = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      const email = item.emailAddresses?.map((entry) => entry.address).join(" ") ?? "";
      const haystack = `${item.displayName} ${item.department ?? ""} ${email}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [items, query, statusFilter]);

  async function setStatus(item: ApiProfile, status: "inactive" | "archived") {
    const reason = status === "archived" ? window.prompt("Archive reason") : undefined;
    if (status === "archived" && !reason) return;
    await bizCardFetch(`/api/admin/business-cards/${item.profileId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, version: item.version, reason }),
    });
    setMessage(`${item.displayName} is ${status}.`);
    const page = await bizCardFetch<{ items: ApiProfile[] }>("/api/admin/business-cards");
    setItems(page.items);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="w-full max-w-sm rounded border border-slate-700 bg-slate-950 p-2 text-sm" placeholder="Search name, email, department" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Link className="text-sm underline" href={`${base}/admin/business-cards?status=archived`}>Archived</Link>
        <Link className="text-sm underline" href={`${base}/admin/business-cards/new`}>Create</Link>
      </div>
      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr><th>Name</th><th>Email</th><th>Status</th><th>Views</th><th>Downloads</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr key={item.profileId} className="border-t border-slate-800">
                <td className="py-2">{item.displayName}<div className="text-xs text-slate-500">{item.title}</div></td>
                <td>{item.emailAddresses?.find((email) => email.type === "primary")?.address}</td>
                <td>{item.status}</td>
                <td>{item.totalViews ?? 0}</td>
                <td>{item.totalVcfDownloads ?? 0}</td>
                <td className="space-x-2 py-2 text-xs">
                  <Link className="underline" href={`${base}/admin/business-cards/${item.profileId}`}>Edit</Link>
                  <a className="underline" href={`https://www.nexcortiq.us/card/${item.slug}`} target="_blank" rel="noreferrer">Preview</a>
                  <button type="button" className="underline" onClick={() => void navigator.clipboard.writeText(`https://www.nexcortiq.us/card/${item.slug}`)}>Copy URL</button>
                  <button type="button" className="underline" onClick={() => void setStatus(item, "inactive")}>Deactivate</button>
                  <button type="button" className="underline" onClick={() => void setStatus(item, "archived")}>Archive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminEditor({ profileId }: { profileId: string }) {
  return <CardEditor mode="admin" profileId={profileId} />;
}

type StaffPerson = {
  cognitoUserId: string;
  email: string;
  name: string;
  role: string;
  profileId?: string;
};

export function CreateWizard() {
  const pathname = usePathname() ?? "";
  const base = pathname.replace(/\/admin\/business-cards.*/, "");
  const [step, setStep] = useState(1);
  const [people, setPeople] = useState<StaffPerson[]>([]);
  const [cognitoUserId, setCognitoUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void bizCardFetch<{ people: StaffPerson[] }>("/api/admin/business-cards/staff")
      .then((page) => setPeople(page.people))
      .catch((error: Error) => setMessage(error.message));
  }, []);

  const selected = people.find((person) => person.cognitoUserId === cognitoUserId);

  function choosePerson(userId: string) {
    const person = people.find((item) => item.cognitoUserId === userId);
    setCognitoUserId(userId);
    setMessage("");
    if (!person || person.profileId) return;
    if (!displayName) setDisplayName(person.name);
    if (!email) setEmail(person.email);
  }

  async function activate() {
    if (!cognitoUserId) {
      setMessage("Choose a NexCort iQ person first.");
      return;
    }
    if (selected?.profileId) {
      setMessage("That person already has a card. Open it from the list above.");
      return;
    }
    const [firstName, ...rest] = displayName.split(" ");
    const created = await bizCardFetch<ApiProfile>("/api/admin/business-cards", {
      method: "POST",
      body: JSON.stringify({
        cognitoUserId,
        displayName,
        title,
        firstName,
        lastName: rest.join(" "),
        emailAddresses: email ? [{ type: "primary", address: email, public: true }] : undefined,
      }),
    });
    await bizCardFetch(`/api/admin/business-cards/${created.profileId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active", version: created.version }),
    });
    setMessage(`Live at https://www.nexcortiq.us/card/${created.slug}`);
  }

  return (
    <div className="max-w-xl space-y-4 text-sm">
      <p className="text-slate-400">Step {step} of 6. The card is not public until Activate.</p>
      {step === 1 ? (
        <label className="block text-xs text-slate-400">NexCort iQ person
          <select className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm" value={cognitoUserId} onChange={(event) => choosePerson(event.target.value)}>
            <option value="">Select a person</option>
            {people.map((person) => (
              <option key={person.cognitoUserId} value={person.cognitoUserId}>
                {person.name} · {person.email}{person.profileId ? " · has a card" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {step === 1 && selected?.profileId ? (
        <p>This person already has a card. <Link className="underline" href={`${base}/admin/business-cards/${selected.profileId}`}>Edit their card</Link></p>
      ) : null}
      {step === 2 ? (
        <>
          <label className="block text-xs text-slate-400">Display name<input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="block text-xs text-slate-400">Title<input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="block text-xs text-slate-400">Primary email<input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        </>
      ) : null}
      {step === 3 ? <p>Company name stays locked to NexCort iQ. Email and website can be edited on the card.</p> : null}
      {step === 4 ? <p>Skip NFC for now, or assign a tag from NFC Card Management after activation.</p> : null}
      {step === 5 ? <p>{displayName || "This person"} · {title || "Title"} · the public page stays offline until the next step.</p> : null}
      {step === 6 ? <button type="button" className="rounded bg-sky-700 px-3 py-2" onClick={() => void activate().catch((error: Error) => setMessage(error.message))}>Activate</button> : null}
      <div className="flex gap-2">
        <button type="button" className="rounded border border-slate-600 px-3 py-2" onClick={() => setStep((value) => Math.max(1, value - 1))}>Back</button>
        {step < 6 ? <button type="button" className="rounded border border-slate-600 px-3 py-2 disabled:opacity-40" disabled={step === 1 && (!cognitoUserId || Boolean(selected?.profileId))} onClick={() => setStep((value) => value + 1)}>Next</button> : null}
      </div>
      {message ? <p>{message}</p> : null}
    </div>
  );
}

export function CardSettings() {
  const [enabled, setEnabled] = useState(false);
  const [requireSetup, setRequireSetup] = useState(false);
  const [defaultTheme, setDefaultTheme] = useState("navy");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [lockTitle, setLockTitle] = useState(false);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void bizCardFetch<{ enabled?: boolean; requireSetup?: boolean; defaultTheme?: string; companyWebsite?: string; lockedFields?: string[]; version?: number }>("/api/admin/business-cards/settings").then((row) => {
      setEnabled(Boolean(row.enabled));
      setRequireSetup(Boolean(row.requireSetup));
      setDefaultTheme(row.defaultTheme ?? "navy");
      setCompanyWebsite(row.companyWebsite ?? "");
      setLockTitle(Boolean(row.lockedFields?.includes("title")));
      setVersion(row.version ?? 0);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  return (
    <form className="max-w-lg space-y-3 text-sm" onSubmit={(event) => {
      event.preventDefault();
      void bizCardFetch("/api/admin/business-cards/settings", {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          requireSetup,
          defaultTheme,
          companyWebsite: normalizeWebsite(companyWebsite) || undefined,
          lockedFields: lockTitle ? ["title", "companyName"] : ["companyName"],
          defaultVisibility: { title: true, biography: true, website: true, photo: true, "phone:mobile": true, "email:primary": true },
          version,
        }),
      }).then(() => setMessage(enabled ? "Business cards are on for this agency." : "Saved. Turn on Enable business cards before Activate or adding a tag.")).catch((error: Error) => setMessage(error.message));
    }}>
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable business cards for this agency</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={requireSetup} onChange={(event) => setRequireSetup(event.target.checked)} /> Prompt new users to set up a card</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={lockTitle} onChange={(event) => setLockTitle(event.target.checked)} /> Lock job title on new cards</label>
      <label className="block text-xs text-slate-400">Default theme
        <select className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" value={defaultTheme} onChange={(event) => setDefaultTheme(event.target.value)}>
          <option value="navy">Navy</option>
          <option value="gold">Gold</option>
          <option value="slate">Slate</option>
          <option value="midnight">Midnight</option>
        </select>
      </label>
      <label className="block text-xs text-slate-400">Company website
        <input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} placeholder="www.nexcortiq.com" />
      </label>
      <button className="rounded bg-sky-700 px-3 py-2" type="submit">Save settings</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}

export function AuditList() {
  const [items, setItems] = useState<Array<{ auditId: string; action: string; occurredAt: number; changedFields?: string[]; actorRole: string }>>([]);
  useEffect(() => {
    void bizCardFetch<{ items: typeof items }>("/api/admin/business-cards/audit").then((page) => setItems(page.items)).catch(() => setItems([]));
  }, []);
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => <li key={item.auditId}>{new Date(item.occurredAt).toISOString()} · {item.actorRole} · {item.action} · {(item.changedFields ?? []).join(", ")}</li>)}
      {items.length === 0 ? <li className="text-slate-500">No audit rows for this month.</li> : null}
    </ul>
  );
}

export function AnalyticsPanel() {
  const [row, setRow] = useState<{ activeProfiles: number; totalProfiles: number; totalViews: number } | null>(null);
  useEffect(() => {
    void bizCardFetch<NonNullable<typeof row>>("/api/admin/analytics/business-cards").then(setRow).catch(() => setRow(null));
  }, []);
  if (!row) return <p className="text-sm text-slate-400">Analytics appear after business cards are enabled for this agency.</p>;
  const ratio = row.totalProfiles ? Math.round((row.activeProfiles / row.totalProfiles) * 100) : 0;
  return <p className="text-sm">{row.activeProfiles} active of {row.totalProfiles} profiles ({ratio}%) · {row.totalViews} views</p>;
}

export function NfcAdmin() {
  const pathname = usePathname() ?? "";
  const [items, setItems] = useState<NfcItem[]>([]);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [reason, setReason] = useState("");
  const [assignTo, setAssignTo] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const tool = existingNfcToolHref(pathname);

  async function reload() {
    const [cards, people] = await Promise.all([
      bizCardFetch<{ items: NfcItem[] }>("/api/admin/nfc-cards"),
      bizCardFetch<{ items: ApiProfile[] }>("/api/admin/business-cards"),
    ]);
    setItems(cards.items);
    setProfiles(people.items);
  }

  useEffect(() => {
    void reload().catch((error: Error) => setMessage(error.message));
  }, []);

  return (
    <div className="space-y-3 text-sm">
      <p>Assign the tag, then write its address onto an NTAG213. Chrome on Android writes the sticker from this page. A later edit to the contact page does not require another write.</p>
      {message ? <p className="text-amber-200">{message}</p> : null}
      <button type="button" className="rounded border border-slate-600 px-3 py-2" onClick={() => void bizCardFetch("/api/admin/nfc-cards", { method: "POST", body: JSON.stringify({ tagType: "NTAG213" }) }).then(reload).catch((error: Error) => setMessage(error.message))}>Add NTAG213</button>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr><th>Card</th><th>Tag</th><th>Assigned</th><th>Status</th><th>URL</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.cardId} className="border-t border-slate-800 align-top">
                <td className="py-2 font-mono text-xs">{item.cardId.slice(0, 8)}</td>
                <td>{item.tagType}</td>
                <td>{profiles.find((profile) => profile.profileId === item.assignedProfileId)?.displayName ?? "—"}</td>
                <td>{item.status}</td>
                <td className="max-w-[220px] break-all text-xs">{item.permanentUrl}</td>
                <td className="space-y-1 py-2">
                  <select className="w-full rounded border border-slate-700 bg-slate-950 p-1" value={assignTo[item.cardId] ?? ""} onChange={(event) => setAssignTo({ ...assignTo, [item.cardId]: event.target.value })}>
                    <option value="">Assign to…</option>
                    {profiles.map((profile) => <option key={profile.profileId} value={profile.profileId}>{profile.displayName}</option>)}
                  </select>
                  <button type="button" className="block underline" onClick={() => {
                    const profileId = assignTo[item.cardId];
                    if (!profileId) {
                      setMessage("Choose a person before assigning this tag.");
                      return;
                    }
                    void bizCardFetch(`/api/admin/nfc-cards/${item.cardId}/assign`, { method: "PATCH", body: JSON.stringify({ profileId, version: item.version }) }).then(reload).catch((error: Error) => setMessage(error.message));
                  }}>Assign</button>
                  <WriteNfcButton
                    url={item.permanentUrl}
                    onWritten={() => {
                      void bizCardFetch(`/api/admin/nfc-cards/${item.cardId}/status`, { method: "PATCH", body: JSON.stringify({ status: "programmed", version: item.version }) }).then(reload).catch((error: Error) => setMessage(error.message));
                    }}
                  />
                  <a className="block underline" href={`${tool}?programUrl=${encodeURIComponent(item.permanentUrl)}`}>Open QR/NFC instructions</a>
                  <button type="button" className="block underline" onClick={() => void bizCardFetch(`/api/admin/nfc-cards/${item.cardId}/status`, { method: "PATCH", body: JSON.stringify({ status: "programmed", version: item.version }) }).then(reload)}>Mark programmed</button>
                  <button type="button" className="block underline" onClick={() => void bizCardFetch(`/api/admin/nfc-cards/${item.cardId}/status`, { method: "PATCH", body: JSON.stringify({ status: "verified", version: item.version }) }).then(reload)}>Mark verified</button>
                  <button type="button" className="block underline" onClick={() => void bizCardFetch(`/api/admin/nfc-cards/${item.cardId}/revoke`, { method: "PATCH", body: JSON.stringify({ reason, version: item.version }) }).then(reload).catch((error: Error) => setMessage(error.message))}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="block text-xs text-slate-400">Revoke reason
        <input className="mt-1 w-full max-w-md rounded border border-slate-700 bg-slate-950 p-2" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
    </div>
  );
}

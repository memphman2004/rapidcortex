"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import QRCode from "qrcode";
import { bizCardFetch } from "@/lib/business-cards/client";

type Phone = { type: "mobile" | "office" | "sms" | "fax"; number: string; extension?: string; public: boolean };
type Email = { type: "primary" | "secondary"; address: string; public: boolean };
type Link = { type: "linkedin" | "website" | "calendar" | "custom"; label?: string; url: string; public: boolean };

type Profile = {
  profileId: string;
  publicProfileId: string;
  slug: string;
  displayName: string;
  credentials?: string;
  title: string;
  department?: string;
  companyName: string;
  biography?: string;
  phoneNumbers: Phone[];
  emailAddresses: Email[];
  website?: string;
  officeAddress?: { city?: string; state?: string; postalCode?: string; public: boolean };
  socialLinks: Link[];
  cardTheme: "navy" | "gold" | "slate" | "midnight";
  status: string;
  lockedFields: string[];
  version: number;
  totalViews?: number;
  totalVcfDownloads?: number;
  cognitoUserId?: string;
  internalNotes?: string;
};

const THEMES = {
  navy: ["#0b1f33", "#7eb6ff"],
  gold: ["#1a1408", "#c9a84c"],
  slate: ["#1c1f26", "#cbd5e1"],
  midnight: ["#070712", "#a78bfa"],
} as const;

const PUBLIC_BASE = "https://www.nexcortiq.us";

function existingNfcToolHref(pathname: string): string {
  if (pathname.startsWith("/rc-admin")) return "/rc-admin/qr-nfc";
  if (pathname.startsWith("/app/campus/")) {
    const code = pathname.split("/")[3];
    return code && code !== "admin" ? `/app/campus/${code}/qr-codes` : "/app/campus/admin/qr-codes";
  }
  if (pathname.startsWith("/app/venue")) return "/app/venue/admin/qr-codes";
  if (pathname.startsWith("/transit/") || pathname.startsWith("/app/transit")) return "/app/transit/admin/qr-codes";
  const jurisdiction = pathname.split("/").filter(Boolean)[0];
  return jurisdiction ? `/${jurisdiction}/admin/qr-codes` : "/admin/qr-codes";
}

function viewFromPath(pathname: string): "editor" | "directory" | "wizard" | "settings" | "audit" | "nfc" | "analytics" {
  if (pathname.includes("/profile/business-card")) return "editor";
  if (pathname.includes("/nfc-cards")) return "nfc";
  if (pathname.includes("/analytics/business-cards")) return "analytics";
  if (pathname.endsWith("/new")) return "wizard";
  if (pathname.endsWith("/settings")) return "settings";
  if (pathname.endsWith("/audit")) return "audit";
  return "directory";
}

export function BusinessCardScreen() {
  const pathname = usePathname() ?? "";
  const view = viewFromPath(pathname);
  return (
    <div className="mx-auto max-w-6xl text-slate-100">
      <h1 className="text-xl font-semibold">Business Card Information</h1>
      <p className="mt-1 text-sm text-slate-400">Share a contact card with a tap. Company name stays locked to this agency.</p>
      <div className="mt-6">
        {view === "editor" ? <EmployeeEditor /> : null}
        {view === "directory" ? <Directory /> : null}
        {view === "wizard" ? <Wizard /> : null}
        {view === "settings" ? <Settings /> : null}
        {view === "audit" ? <AuditList /> : null}
        {view === "nfc" ? <NfcPanel qrHref={existingNfcToolHref(pathname)} /> : null}
        {view === "analytics" ? <Analytics /> : null}
      </div>
    </div>
  );
}

function EmployeeEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"edit" | "nfc" | "share">("edit");
  const [message, setMessage] = useState("");
  const [qr, setQr] = useState("");
  const [draft, setDraft] = useState<Partial<Profile>>({});

  useEffect(() => {
    bizCardFetch<Profile>("/api/business-cards/me")
      .then((next) => {
        const stored = localStorage.getItem(`rc_bizcard_draft_${next.profileId}`);
        setProfile(next);
        setDraft(stored ? { ...next, ...JSON.parse(stored) } : next);
      })
      .catch(() => setMessage("Save your card to create it. It stays private until you publish."));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (!profile) return;
      localStorage.setItem(`rc_bizcard_draft_${profile.profileId}`, JSON.stringify(draft));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draft, profile]);

  const slug = draft.slug || profile?.slug || "your-card";
  const url = `${PUBLIC_BASE}/card/${slug}`;

  useEffect(() => {
    void QRCode.toDataURL(url, { width: 300, margin: 1 }).then(setQr);
  }, [url]);

  const locked = new Set(profile?.lockedFields ?? ["companyName", "website", "primaryEmail"]);

  async function save() {
    const body = {
      version: profile?.version,
      displayName: draft.displayName,
      credentials: draft.credentials,
      title: draft.title,
      department: draft.department,
      biography: draft.biography,
      phoneNumbers: draft.phoneNumbers,
      socialLinks: draft.socialLinks,
      officeAddress: draft.officeAddress,
      cardTheme: draft.cardTheme,
      slug: locked.has("slug") ? undefined : draft.slug,
    };
    try {
      const saved = profile
        ? await bizCardFetch<Profile>("/api/business-cards/me", { method: "PUT", body: JSON.stringify(body) })
        : await bizCardFetch<Profile>("/api/business-cards/me", { method: "PUT", body: JSON.stringify({ ...body, version: undefined, ...draft }) });
      setProfile(saved);
      localStorage.removeItem(`rc_bizcard_draft_${saved.profileId}`);
      setMessage("Saved.");
    } catch (error) {
      const status = (error as { status?: number }).status;
      setMessage(status === 409 ? "Your version is behind the server version. Reload, then save again." : (error as Error).message);
    }
  }

  async function publish() {
    const saved = await bizCardFetch<Profile>("/api/business-cards/me/publish", { method: "POST" });
    setProfile(saved);
    setMessage("Your card is live.");
  }

  const form = { ...profile, ...draft } as Profile;
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["edit", "nfc", "share"] as const).map((item) => (
          <button key={item} type="button" className="rounded border border-slate-700 px-3 py-2 text-sm capitalize" onClick={() => setTab(item)}>
            {item === "nfc" ? "NFC preview" : item}
          </button>
        ))}
      </div>
      {message ? <p className="mb-3 text-sm text-amber-200">{message}</p> : null}
      {tab === "edit" ? (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form className="max-h-[70vh] space-y-3 overflow-auto pr-2" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <Field label="Display name" locked={locked.has("displayName")} value={form.displayName ?? ""} onChange={(value) => setDraft({ ...draft, displayName: value })} />
            <Field label="Credentials" locked={locked.has("credentials")} value={form.credentials ?? ""} onChange={(value) => setDraft({ ...draft, credentials: value })} />
            <Field label="Job title" locked={locked.has("title")} value={form.title ?? ""} onChange={(value) => setDraft({ ...draft, title: value })} />
            <Field label="Department" locked={locked.has("department")} value={form.department ?? ""} onChange={(value) => setDraft({ ...draft, department: value })} />
            <Field label="Company name" locked value={form.companyName ?? ""} onChange={() => undefined} />
            <label className="block text-xs text-slate-400">
              Biography ({(form.biography ?? "").length}/280)
              <textarea className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm" maxLength={280} value={form.biography ?? ""} onChange={(event) => setDraft({ ...draft, biography: event.target.value })} />
            </label>
            <Field label="Public address" locked={locked.has("slug")} value={form.slug ?? ""} onChange={(value) => setDraft({ ...draft, slug: value })} />
            <label className="block text-xs text-slate-400">
              Theme
              <select className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm" value={form.cardTheme ?? "navy"} onChange={(event) => setDraft({ ...draft, cardTheme: event.target.value as Profile["cardTheme"] })}>
                <option value="navy">Navy</option>
                <option value="gold">Gold</option>
                <option value="slate">Slate</option>
                <option value="midnight">Midnight</option>
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Photo
              <input
                className="mt-1 block text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void (async () => {
                    const issued = await bizCardFetch<{ uploadUrl: string; key: string }>("/api/business-cards/me/photo", {
                      method: "POST",
                      body: JSON.stringify({ contentType: file.type, contentLength: file.size }),
                    });
                    await fetch(issued.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
                    await bizCardFetch("/api/business-cards/me/photo/complete", {
                      method: "POST",
                      body: JSON.stringify({ key: issued.key }),
                    });
                    setMessage("Photo saved.");
                  })().catch((error: Error) => setMessage(error.message));
                }}
              />
            </label>
            <button className="rounded bg-sky-700 px-3 py-2 text-sm" type="submit">Save</button>
            <button className="ml-2 rounded border border-slate-600 px-3 py-2 text-sm" type="button" onClick={() => void publish()}>Publish</button>
          </form>
          <CardPreview profile={form} qr={qr} />
        </div>
      ) : null}
      {tab === "nfc" ? <PhonePreview profile={form} url={url} /> : null}
      {tab === "share" ? <SharePanel url={url} profile={form} /> : null}
    </div>
  );
}

function Field({ label, value, onChange, locked }: { label: string; value: string; onChange: (value: string) => void; locked?: boolean }) {
  return (
    <label className="block text-xs text-slate-400">
      {label} {locked ? <span aria-hidden>🔒</span> : null}
      <input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm disabled:opacity-60" disabled={locked} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CardPreview({ profile, qr }: { profile: Partial<Profile>; qr: string }) {
  const theme = THEMES[profile.cardTheme ?? "navy"];
  return (
    <div className="rounded-2xl p-6" style={{ background: theme[0], color: "#f8f8f8" }}>
      <p className="text-right text-xs" style={{ color: theme[1] }}>NexCort iQ</p>
      <p className="mt-4 text-2xl font-semibold">{profile.displayName || "Your name"}</p>
      <p className="text-sm text-white/70">{profile.credentials}</p>
      <p>{profile.title}</p>
      <p className="text-sm" style={{ color: theme[1] }}>{profile.companyName}</p>
      {qr ? <img alt="QR code for this card" className="mt-4 h-36 w-36 bg-white p-2" src={qr} /> : null}
    </div>
  );
}

function PhonePreview({ profile, url }: { profile: Partial<Profile>; url: string }) {
  return (
    <div className="mx-auto w-[300px] rounded-[2rem] border border-slate-700 bg-black p-4" style={{ aspectRatio: "9 / 19.5" }}>
      <p className="text-center text-lg">{profile.displayName}</p>
      <p className="text-center text-sm text-slate-400">{profile.title}</p>
      <a className="mt-6 block rounded bg-[#c9a84c] px-3 py-3 text-center text-sm font-semibold text-black" href={`/api/public/business-cards/${profile.publicProfileId}/contact.vcf`}>
        Add to Contacts
      </a>
      <p className="mt-4 break-all text-xs text-slate-400">{url}</p>
      <button type="button" className="mt-2 text-xs underline" onClick={() => void navigator.clipboard.writeText(url)}>Copy NFC URL</button>
    </div>
  );
}

function SharePanel({ url, profile }: { url: string; profile: Partial<Profile> }) {
  async function download(kind: "png" | "svg") {
    if (kind === "png") {
      const data = await QRCode.toDataURL(url, { width: 1200, margin: 1 });
      const link = document.createElement("a");
      link.href = data;
      link.download = `${profile.slug || "card"}.png`;
      link.click();
      return;
    }
    const svg = await QRCode.toString(url, { type: "svg" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    link.download = `${profile.slug || "card"}.svg`;
    link.click();
  }
  return (
    <div className="space-y-3 text-sm">
      <p className="break-all">{url}</p>
      <button type="button" className="rounded border border-slate-600 px-3 py-2" onClick={() => void navigator.clipboard.writeText(url)}>Copy permanent URL</button>
      <button type="button" className="ml-2 rounded border border-slate-600 px-3 py-2" onClick={() => void download("png")}>Download QR PNG</button>
      <button type="button" className="ml-2 rounded border border-slate-600 px-3 py-2" onClick={() => void download("svg")}>Download QR SVG</button>
      <button type="button" className="ml-2 rounded border border-slate-600 px-3 py-2" onClick={() => void (navigator.share ? navigator.share({ url, title: profile.displayName }) : navigator.clipboard.writeText(url))}>Share</button>
      <p className="text-slate-400">Views {profile.totalViews ?? 0} · vCard downloads {profile.totalVcfDownloads ?? 0}</p>
    </div>
  );
}

function Directory() {
  const [items, setItems] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void bizCardFetch<{ items: Profile[] }>("/api/admin/business-cards").then((page) => setItems(page.items)).catch(() => setItems([]));
  }, []);
  const shown = useMemo(
    () => items.filter((item) => `${item.displayName} ${item.department ?? ""} ${item.emailAddresses?.[0]?.address ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  return (
    <div>
      <input className="mb-4 w-full max-w-sm rounded border border-slate-700 bg-slate-950 p-2 text-sm" placeholder="Search name, email, department" value={query} onChange={(event) => setQuery(event.target.value)} />
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400"><tr><th>Name</th><th>Status</th><th>Views</th><th>Updated</th></tr></thead>
        <tbody>
          {shown.map((item) => (
            <tr key={item.profileId} className="border-t border-slate-800">
              <td className="py-2">{item.displayName}<div className="text-xs text-slate-500">{item.title}</div></td>
              <td>{item.status}</td>
              <td>{item.totalViews ?? 0}</td>
              <td>{item.version}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Wizard() {
  const [step, setStep] = useState(1);
  const [cognitoUserId, setCognitoUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  async function create(activate: boolean) {
    const created = await bizCardFetch<Profile>("/api/admin/business-cards", {
      method: "POST",
      body: JSON.stringify({ cognitoUserId, displayName, title, firstName: displayName.split(" ")[0], lastName: displayName.split(" ").slice(1).join(" ") }),
    });
    if (activate) {
      await bizCardFetch(`/api/admin/business-cards/${created.profileId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active", version: created.version }),
      });
    }
    setMessage(activate ? `Live at /card/${created.slug}` : "Saved as a draft.");
  }
  return (
    <div className="max-w-xl space-y-3 text-sm">
      <p>Step {step} of 6</p>
      {step === 1 ? <Field label="Cognito user id from Users" value={cognitoUserId} onChange={setCognitoUserId} /> : null}
      {step === 2 ? (
        <>
          <Field label="Display name" value={displayName} onChange={setDisplayName} />
          <Field label="Title" value={title} onChange={setTitle} />
        </>
      ) : null}
      {step === 3 ? <p>Company name, primary email, and website stay locked.</p> : null}
      {step === 4 ? <p>Assign an NFC tag later from NFC Card Management. Programming stays in the existing QR/NFC tool.</p> : null}
      {step === 5 ? <p>The public page stays offline until you activate.</p> : null}
      {step === 6 ? <button type="button" className="rounded bg-sky-700 px-3 py-2" onClick={() => void create(true)}>Activate</button> : null}
      <div className="flex gap-2">
        <button type="button" className="rounded border border-slate-600 px-3 py-2" onClick={() => setStep(Math.max(1, step - 1))}>Back</button>
        {step < 6 ? <button type="button" className="rounded border border-slate-600 px-3 py-2" onClick={() => setStep(step + 1)}>Next</button> : null}
      </div>
      {message ? <p>{message}</p> : null}
    </div>
  );
}

function Settings() {
  const [enabled, setEnabled] = useState(false);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void bizCardFetch<{ enabled?: boolean; version?: number }>("/api/admin/business-cards/settings").then((row) => {
      setEnabled(Boolean(row.enabled));
      setVersion(row.version ?? 0);
    }).catch(() => undefined);
  }, []);
  return (
    <form className="space-y-3 text-sm" onSubmit={(event) => {
      event.preventDefault();
      void bizCardFetch("/api/admin/business-cards/settings", {
        method: "PUT",
        body: JSON.stringify({ enabled, version, defaultTheme: "navy", requireSetup: false }),
      }).then(() => setMessage("Saved for this agency.")).catch((error: Error) => setMessage(error.message));
    }}>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Enable business cards for this agency
      </label>
      <p className="text-slate-400">Default theme is navy. Company name is always taken from the agency record.</p>
      <button className="rounded bg-sky-700 px-3 py-2" type="submit">Save settings</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}

function AuditList() {
  const [items, setItems] = useState<Array<{ auditId: string; action: string; occurredAt: number; changedFields?: string[] }>>([]);
  useEffect(() => {
    void bizCardFetch<{ items: typeof items }>("/api/admin/business-cards/audit").then((page) => setItems(page.items)).catch(() => setItems([]));
  }, []);
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.auditId}>{item.action} · {(item.changedFields ?? []).join(", ")}</li>
      ))}
    </ul>
  );
}

function Analytics() {
  const [row, setRow] = useState<{ activeProfiles: number; totalProfiles: number; totalViews: number } | null>(null);
  useEffect(() => {
    void bizCardFetch<NonNullable<typeof row>>("/api/admin/analytics/business-cards").then(setRow).catch(() => setRow(null));
  }, []);
  if (!row) return <p className="text-sm text-slate-400">Analytics appear after the feature is enabled for this agency.</p>;
  return <p className="text-sm">{row.activeProfiles} active · {row.totalProfiles} profiles · {row.totalViews} views</p>;
}

function NfcPanel({ qrHref }: { qrHref: string }) {
  const [items, setItems] = useState<Array<{ cardId: string; tagType: string; status: string; permanentUrl: string; version: number; assignedProfileId?: string }>>([]);
  const [reason, setReason] = useState("");
  useEffect(() => {
    void bizCardFetch<{ items: typeof items }>("/api/admin/nfc-cards").then((page) => setItems(page.items)).catch(() => setItems([]));
  }, []);
  return (
    <div className="space-y-3 text-sm">
      <p>Program the tag in the existing QR/NFC tool. This page assigns, marks, and revokes the business-card record.</p>
      <a className="underline" href={qrHref}>Open QR/NFC programming</a>
      <button type="button" className="ml-3 rounded border border-slate-600 px-3 py-2" onClick={() => void bizCardFetch("/api/admin/nfc-cards", { method: "POST", body: JSON.stringify({ tagType: "NTAG213" }) }).then(() => location.reload())}>Add NTAG213</button>
      <table className="w-full text-left">
        <thead><tr><th>Card</th><th>Tag</th><th>Status</th><th>URL</th><th></th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.cardId} className="border-t border-slate-800">
              <td className="py-2">{item.cardId.slice(0, 8)}</td>
              <td>{item.tagType}</td>
              <td>{item.status}</td>
              <td className="max-w-[240px] truncate">{item.permanentUrl}</td>
              <td className="space-x-2">
                <button type="button" onClick={() => void bizCardFetch(`/api/admin/nfc-cards/${item.cardId}/status`, { method: "PATCH", body: JSON.stringify({ status: "programmed", version: item.version }) }).then(() => location.reload())}>Mark programmed</button>
                <button type="button" onClick={() => void bizCardFetch(`/api/admin/nfc-cards/${item.cardId}/revoke`, { method: "PATCH", body: JSON.stringify({ reason, version: item.version }) }).then(() => location.reload())}>Revoke</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="block text-xs text-slate-400">
        Revoke reason
        <input className="mt-1 w-full max-w-md rounded border border-slate-700 bg-slate-950 p-2" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
    </div>
  );
}

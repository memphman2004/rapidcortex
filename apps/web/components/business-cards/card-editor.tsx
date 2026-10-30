"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QRCode from "qrcode";
import { bizCardFetch } from "@/lib/business-cards/client";
import {
  BIOGRAPHY_MAX_LENGTH,
  EMPTY_FORM,
  cardFormIssues,
  formFromProfile,
  payloadFromForm,
  type ApiProfile,
  type CardForm,
  type CardTheme,
  type SocialDraft,
} from "@/lib/business-cards/form";
import { SocialGlyph, SmartphonePreview, THEME_PRESETS } from "./phone-card";
import { PhotoCropDialog } from "./photo-crop-dialog";
import { WriteNfcButton } from "./write-nfc-button";

const PUBLIC_BASE = "https://www.nexcortiq.us";
const SERVICES: Array<{ label: string; type: SocialDraft["type"]; hint: string; multiple?: boolean }> = [
  { label: "LinkedIn", type: "linkedin", hint: "Add profile link" },
  { label: "Instagram", type: "custom", hint: "Add profile link" },
  { label: "Facebook", type: "custom", hint: "Add profile link" },
  { label: "X", type: "custom", hint: "Add profile link" },
  { label: "YouTube", type: "custom", hint: "Add profile link" },
  { label: "TikTok", type: "custom", hint: "Add profile link" },
  { label: "Calendar", type: "calendar", hint: "Add a calendar link" },
  { label: "Custom Link", type: "custom", hint: "Add any https link", multiple: true },
];

type SaveState = "unsaved" | "saving" | "saved" | "published" | "error";
type NfcItem = { cardId: string; status: string; permanentUrl: string; assignedProfileId?: string };

type Props = {
  mode: "self" | "admin";
  profileId?: string;
};

export function CardEditor({ mode, profileId }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [form, setForm] = useState<CardForm>(EMPTY_FORM);
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<"create" | "nfc" | "share">("create");
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [qr, setQr] = useState("");
  const [ready, setReady] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [owners, setOwners] = useState<ApiProfile[]>([]);
  const [nfcCards, setNfcCards] = useState<NfcItem[]>([]);
  const originalPhoto = useRef<File | null>(null);
  const pendingPhoto = useRef<File | null>(null);
  const pendingCover = useRef<File | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    const path = mode === "admin" && profileId ? `/api/admin/business-cards/${profileId}` : "/api/business-cards/me";
    bizCardFetch<ApiProfile & { photoUrl?: string }>(path)
      .then((profile) => {
        const stored = localStorage.getItem(`rc_bizcard_draft_${profile.profileId}`);
        const next = hydrate(profile, stored);
        setForm(next);
        setSaved(JSON.stringify(next));
        setPhotoUrl(profile.photoUrl ?? "");
        setCoverUrl(profile.coverUrl ?? "");
        setSaveState(profile.status === "active" ? "published" : "saved");
        setReady(true);
      })
      .catch(() => {
        setReady(true);
        if (mode === "self") setMessage("Save creates your card. It stays private until you publish.");
      });
  }, [mode, profileId]);

  useEffect(() => {
    if (mode !== "admin") return;
    void bizCardFetch<{ items: ApiProfile[] }>("/api/admin/business-cards")
      .then((page) => setOwners(page.items))
      .catch(() => setOwners([]));
    void bizCardFetch<{ items: NfcItem[] }>("/api/admin/nfc-cards")
      .then((page) => setNfcCards(page.items))
      .catch(() => setNfcCards([]));
  }, [mode]);

  useEffect(() => {
    if (!form.profileId || !ready) return;
    const handle = window.setTimeout(() => {
      localStorage.setItem(`rc_bizcard_draft_${form.profileId}`, JSON.stringify(form));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [form, ready]);

  const dirty = ready && saved !== "" && JSON.stringify(form) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmLeave = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href || href.startsWith("#") || anchor.getAttribute("target") === "_blank") return;
      if (!window.confirm("You have unsaved changes. Leave this page?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", confirmLeave, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", confirmLeave, true);
    };
  }, [dirty]);

  const slug = form.slug || "your-card";
  const profileUrl = `${PUBLIC_BASE}/card/${slug}`;
  const assigned = nfcCards.find((card) => card.assignedProfileId === form.profileId && card.status !== "revoked");
  const nfcUrl = assigned?.permanentUrl || profileUrl;
  useEffect(() => {
    void QRCode.toDataURL(profileUrl, { width: 280, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } }).then(setQr);
  }, [profileUrl]);

  const locked = new Set(form.lockedFields);
  const isLocked = (field: string) => mode !== "admin" && locked.has(field);
  const address = [form.street, form.city, form.state, form.postalCode, form.country].filter(Boolean).join(", ");
  const links = useMemo(
    () => form.orderedLinks.filter((item) => item.url.trim().length > "https://".length).map((item) => ({
      label: item.label,
      href: item.url,
      eventType: item.type === "linkedin" ? "linkedin_click" : item.type === "calendar" ? "calendar_click" : "web_click",
    })),
    [form.orderedLinks],
  );
  const statusLabel = dirty ? "Unsaved Changes" : saveState === "saving" ? "Saving" : saveState === "error" ? "Error Saving" : saveState === "published" ? "Published" : "Saved";

  function patch(partial: Partial<CardForm>) {
    setForm((current) => ({ ...current, ...partial }));
    setSaveState("unsaved");
  }

  function setLinks(orderedLinks: SocialDraft[]) {
    const linkedin = orderedLinks.find((item) => item.type === "linkedin");
    const calendar = orderedLinks.find((item) => item.type === "calendar");
    const extras = orderedLinks.filter((item) => item.type === "custom").map((item) => ({ label: item.label, url: item.url, public: item.public }));
    patch({
      orderedLinks,
      linkedin: linkedin?.url ?? "",
      linkedinPublic: linkedin?.public ?? true,
      calendar: calendar?.url ?? "",
      calendarPublic: calendar?.public ?? true,
      extras,
    });
  }

  async function uploadAsset(file: File, id: string, purpose: "profile" | "cover") {
    const photoPath = mode === "admin" ? `/api/admin/business-cards/${id}/photo` : "/api/business-cards/me/photo";
    const issued = await bizCardFetch<{ uploadUrl: string; key: string }>(photoPath, {
      method: "POST",
      body: JSON.stringify({ contentType: file.type, contentLength: file.size, purpose }),
    });
    let put: Response;
    try {
      put = await fetch(issued.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    } catch {
      throw new Error("The photo could not be uploaded. Save the card again.");
    }
    if (!put.ok) throw new Error("Photo upload failed.");
    await bizCardFetch(`${photoPath}/complete`, { method: "POST", body: JSON.stringify({ key: issued.key, purpose }) });
    if (purpose === "cover") pendingCover.current = null;
    else pendingPhoto.current = null;
  }

  async function save(): Promise<ApiProfile | null> {
    if (saving.current) return null;
    const found = cardFormIssues(form);
    setIssues(found);
    if (found.length) {
      setSaveState("error");
      return null;
    }
    saving.current = true;
    setSaveState("saving");
    const body = payloadFromForm(form, mode === "admin");
    const path = mode === "admin" && form.profileId ? `/api/admin/business-cards/${form.profileId}` : "/api/business-cards/me";
    try {
      let savedProfile: ApiProfile;
      try {
        savedProfile = await bizCardFetch<ApiProfile>(path, { method: "PUT", body: JSON.stringify(body) });
      } catch (error) {
        const coded = error as { status?: number; code?: string };
        if (coded.status !== 409 || coded.code === "slug_taken") throw error;
        const latest = await bizCardFetch<ApiProfile>(path);
        const retry = payloadFromForm({ ...form, version: latest.version, profileId: latest.profileId, slug: form.slug || latest.slug }, mode === "admin");
        savedProfile = await bizCardFetch<ApiProfile>(path, { method: "PUT", body: JSON.stringify(retry) });
      }
      setForm((current) => ({ ...current, version: savedProfile.version, profileId: savedProfile.profileId, slug: savedProfile.slug || current.slug }));
      let next = savedProfile;
      if (mode === "admin") {
        next = await bizCardFetch<ApiProfile>(`/api/admin/business-cards/${savedProfile.profileId}/locks`, {
          method: "PATCH",
          body: JSON.stringify({ lockedFields: form.lockedFields, version: savedProfile.version }),
        });
      }
      if (pendingPhoto.current) await uploadAsset(pendingPhoto.current, savedProfile.profileId, "profile");
      if (pendingCover.current) await uploadAsset(pendingCover.current, savedProfile.profileId, "cover");
      const fresh = formFromProfile(next);
      const merged = { ...fresh, orderedLinks: form.orderedLinks.length ? form.orderedLinks : fresh.orderedLinks, lockedFields: next.lockedFields ?? form.lockedFields };
      setForm(merged);
      setSaved(JSON.stringify(merged));
      localStorage.removeItem(`rc_bizcard_draft_${savedProfile.profileId}`);
      setConflict("");
      setMessage("");
      setSaveState(merged.status === "active" ? "published" : "saved");
      return next;
    } catch (error) {
      const status = (error as { status?: number }).status;
      setSaveState("error");
      if (status === 409) setConflict("Your version is behind the server version. Reload this page, then save again.");
      else setMessage((error as Error).message);
      return null;
    } finally {
      saving.current = false;
    }
  }

  async function publish() {
    const savedProfile = await save();
    if (!savedProfile) return;
    setSaveState("saving");
    try {
      const live = await bizCardFetch<ApiProfile>(
        mode === "admin" ? `/api/admin/business-cards/${savedProfile.profileId}/status` : "/api/business-cards/me/publish",
        {
          method: mode === "admin" ? "PATCH" : "POST",
          body: mode === "admin" ? JSON.stringify({ status: "active", version: savedProfile.version }) : undefined,
        },
      );
      const fresh = formFromProfile(live);
      setForm(fresh);
      setSaved(JSON.stringify(fresh));
      setSaveState("published");
      setMessage("Published. Visitors now see this version.");
    } catch (error) {
      setSaveState("error");
      setMessage((error as Error).message);
    }
  }

  function addService(service: (typeof SERVICES)[number]) {
    if (isLocked("socialLinks")) return;
    const exists = form.orderedLinks.some((item) => item.type === service.type && item.label === service.label);
    if (exists && !service.multiple) return;
    setLinks([
      ...form.orderedLinks,
      { id: crypto.randomUUID(), type: service.type, label: service.label, url: "https://", public: true },
    ]);
  }

  function acceptFile(file: File | undefined) {
    if (!file) return;
    const type = file.type === "image/jpg" || file.type === "image/pjpeg" ? "image/jpeg" : file.type;
    const fromName = /\.png$/i.test(file.name)
      ? "image/png"
      : /\.webp$/i.test(file.name)
        ? "image/webp"
        : /\.jpe?g$/i.test(file.name)
          ? "image/jpeg"
          : "";
    const resolved = ["image/jpeg", "image/png", "image/webp"].includes(type) ? type : fromName;
    if (!resolved || file.size > 5_000_000) {
      setMessage("Use a JPG, PNG, or WebP photo up to 5 MB.");
      setSaveState("error");
      return;
    }
    const photo = resolved === file.type ? file : new File([file], file.name, { type: resolved });
    originalPhoto.current = photo;
    setCropFile(photo);
  }

  async function confirmCrop(file: File) {
    setCropFile(null);
    setPhotoUrl(URL.createObjectURL(file));
    if (!form.profileId) {
      pendingPhoto.current = file;
      setMessage("Photo is ready. Save the card to store it.");
      setSaveState("unsaved");
      return;
    }
    setPhotoBusy(true);
    try {
      await uploadAsset(file, form.profileId, "profile");
      setMessage("Photo saved.");
    } catch (error) {
      pendingPhoto.current = file;
      setMessage((error as Error).message);
      setSaveState("error");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function acceptCover(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5_000_000) {
      setMessage("Use a JPG, PNG, or WebP cover up to 5 MB.");
      setSaveState("error");
      return;
    }
    setCoverUrl(URL.createObjectURL(file));
    if (!form.profileId) {
      pendingCover.current = file;
      setMessage("Cover is ready. Save the card to store it.");
      setSaveState("unsaved");
      return;
    }
    setPhotoBusy(true);
    try {
      await uploadAsset(file, form.profileId, "cover");
      setMessage("Cover saved.");
    } catch (error) {
      pendingCover.current = file;
      setMessage((error as Error).message);
      setSaveState("error");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removeCover() {
    setCoverUrl("");
    pendingCover.current = null;
    if (!form.profileId) return;
    const photoPath = mode === "admin" ? `/api/admin/business-cards/${form.profileId}/photo?purpose=cover` : "/api/business-cards/me/photo?purpose=cover";
    try {
      await bizCardFetch(photoPath, { method: "DELETE" });
      setMessage("Cover removed.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function restoreBranding() {
    patch({ cardTheme: "navy", backgroundColor: "", accentColor: "", photoFocusX: 50, photoFocusY: 50 });
    await removeCover();
  }

  async function removePhoto() {
    setPhotoUrl("");
    originalPhoto.current = null;
    pendingPhoto.current = null;
    if (!form.profileId) return;
    const photoPath = mode === "admin" ? `/api/admin/business-cards/${form.profileId}/photo` : "/api/business-cards/me/photo";
    try {
      await bizCardFetch(photoPath, { method: "DELETE" });
      setMessage("Photo removed.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  if (!ready) {
    return <div className="h-80 animate-pulse rounded-3xl bg-[var(--rc-border)]/40" aria-hidden />;
  }

  const preview = (
    <SmartphonePreview
      name={form.displayName}
      title={form.title}
      department={form.department}
      company={form.companyName || "NexCort iQ"}
      biography={form.biography}
      photoUrl={photoUrl}
      coverUrl={coverUrl}
      backgroundColor={form.backgroundColor || undefined}
      accentColor={form.accentColor || undefined}
      photoFocusX={form.photoFocusX}
      photoFocusY={form.photoFocusY}
      theme={form.cardTheme}
      phone={form.mobile}
      email={form.primaryEmail}
      website={form.website}
      address={address}
      links={links}
      shareUrl={profileUrl}
      onSaveContact={() => downloadDraftVCard(form)}
    />
  );

  return (
    <div className="text-[var(--rc-text-primary)]">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Digital Business Card Studio</h1>
          <p className="mt-1 text-sm text-[var(--rc-text-secondary)]">Create, customize, and publish your NexCort iQ digital business card.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm ${saveState === "error" ? "text-rose-400" : "text-[var(--rc-text-secondary)]"}`} role="status">{statusLabel}</span>
          <button type="button" className="rounded-full border border-[var(--rc-border)] px-4 py-2 text-sm font-semibold lg:hidden" onClick={() => setPane(pane === "edit" ? "preview" : "edit")}>
            {pane === "edit" ? "Preview" : "Edit"}
          </button>
          <button type="button" className="hidden rounded-full border border-[var(--rc-border)] px-4 py-2 text-sm font-semibold lg:inline-flex" onClick={() => document.getElementById("card-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Preview</button>
          <button type="button" className="rounded-full border border-violet-400 bg-white/10 px-4 py-2 text-sm font-semibold motion-safe:transition hover:bg-violet-500/20" onClick={() => void publish()}>Publish</button>
          <button type="button" className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white motion-safe:transition hover:bg-violet-500 disabled:opacity-60" disabled={saveState === "saving"} onClick={() => void save()}>Save Changes</button>
        </div>
      </header>
      {mode === "admin" && (owners.length > 0 || form.profileId) ? (
        <label className="mb-4 block max-w-md text-sm">
          <span className="text-[var(--rc-text-secondary)]">Card owner</span>
          <select
            className="mt-1 w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-bg)] px-3 py-2"
            value={form.profileId ?? profileId ?? ""}
            onChange={(event) => {
              const base = pathname.replace(/\/admin\/business-cards\/[^/]+$/, "");
              router.push(`${base}/admin/business-cards/${event.target.value}`);
            }}
          >
            {(owners.length ? owners : [{ profileId: form.profileId ?? "", displayName: form.displayName || "This card" }]).map((owner) => (
              <option key={owner.profileId} value={owner.profileId}>{owner.displayName}</option>
            ))}
          </select>
        </label>
      ) : null}
      {message ? <p className="mb-3 text-sm text-[var(--rc-text-secondary)]" role="status">{message}</p> : null}
      {issues.length ? <ul className="mb-3 list-disc rounded-2xl border border-rose-400/40 bg-rose-500/10 px-5 py-3 text-sm text-rose-200" role="alert">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
      {conflict ? (
        <div className="mb-3 rounded-2xl border border-amber-300/40 bg-amber-500/10 p-3 text-sm" role="alert">
          {conflict}
          <button type="button" className="ml-3 underline" onClick={() => window.location.reload()}>Reload</button>
        </div>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.38fr)_minmax(0,0.62fr)]">
        <div id="card-preview" className={`${pane === "preview" ? "block" : "hidden"} lg:sticky lg:top-20 lg:block`}>
          <div className="rounded-3xl border border-violet-500/20 bg-slate-950/80 p-4 shadow-[0_0_40px_rgba(109,40,217,0.18)]">
            <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
              <span className="font-semibold text-white">Live Preview</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">Live</span>
            </div>
            <p className="mb-4 text-xs text-slate-400">This is how your NexCort iQ contact page will appear when someone opens your card. It stays private until you publish.</p>
            {preview}
          </div>
        </div>
        <section className={`${pane === "edit" ? "block" : "hidden"} rounded-3xl bg-white p-4 text-slate-900 shadow-xl ring-1 ring-slate-200 md:p-6 lg:block`}>
          <div className="mb-5 flex gap-2" role="tablist">
            {(["create", "nfc", "share"] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={tab === item} className={`rounded-xl px-4 py-2 text-sm font-semibold motion-safe:transition ${tab === item ? "bg-violet-700 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} onClick={() => setTab(item)}>
                {item === "create" ? "Create" : item === "nfc" ? "NFC" : "Share"}
              </button>
            ))}
          </div>
          {tab === "create" ? (
            <div className="space-y-8">
              <Section index="1" title="Profile Photo" copy="This is displayed on your contact page.">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <button
                    type="button"
                    className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-violet-400"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      acceptFile(event.dataTransfer.files?.[0]);
                    }}
                  >
                    <span className="text-sm font-semibold">Upload profile photo</span>
                    <span className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP. Max 5 MB.</span>
                    <span className="mt-3 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Choose File</span>
                  </button>
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-lg font-semibold text-white">
                      {photoUrl ? <img alt="" src={photoUrl} className="h-full w-full object-cover" onError={() => setMessage("The photo could not be loaded. Upload it again.")} /> : initials(form.displayName)}
                    </div>
                    <button type="button" className="text-xs font-semibold text-violet-700" onClick={() => originalPhoto.current ? setCropFile(originalPhoto.current) : fileInput.current?.click()}>Edit photo</button>
                    {photoUrl ? <button type="button" className="text-xs text-slate-500" onClick={() => void removePhoto()}>Remove photo</button> : null}
                    {photoBusy ? <span className="text-xs text-slate-500">Uploading…</span> : null}
                  </div>
                </div>
                <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { acceptFile(event.target.files?.[0]); event.target.value = ""; }} />
              </Section>
              <Section index="2" title="Contact Information" copy="Your name and role appear at the top of the card.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" required>
                    <input disabled={isLocked("displayName")} className={inputClass} value={form.displayName} onChange={(event) => patch({ displayName: event.target.value })} />
                  </Field>
                  <Field label="Company name" locked>
                    <input disabled className={inputClass} value={form.companyName} onChange={() => undefined} />
                  </Field>
                  <Field label="Job title or role">
                    <input disabled={isLocked("title")} className={inputClass} value={form.title} onChange={(event) => patch({ title: event.target.value })} />
                  </Field>
                  <Field label="Department">
                    <input disabled={isLocked("department")} className={inputClass} value={form.department} onChange={(event) => patch({ department: event.target.value })} />
                  </Field>
                </div>
                <Field label="Bio">
                  <textarea disabled={isLocked("biography")} maxLength={BIOGRAPHY_MAX_LENGTH} className={`${inputClass} min-h-40`} value={form.biography} onChange={(event) => patch({ biography: event.target.value })} />
                  <span className="mt-1 block text-xs text-slate-500">{form.biography.length} / {BIOGRAPHY_MAX_LENGTH}</span>
                </Field>
              </Section>
              <Section index="3" title="Contact Details" copy="Blank fields stay off the published card. Phone numbers use E.164, such as +14045550100.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phone number">
                    <input disabled={isLocked("phoneNumbers")} inputMode="tel" className={inputClass} placeholder="+14045550100" value={form.mobile} onChange={(event) => patch({ mobile: event.target.value.trim() })} />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={inputClass} placeholder="name@nexcortiq.us" value={form.primaryEmail} onChange={(event) => patch({ primaryEmail: event.target.value.trim() })} />
                  </Field>
                  <Field label="Website">
                    <input className={inputClass} placeholder="https://www.nexcortiq.us" value={form.website} onChange={(event) => patch({ website: event.target.value.trim() })} />
                  </Field>
                  <Field label="Street address">
                    <input disabled={isLocked("officeAddress")} className={inputClass} value={form.street} onChange={(event) => patch({ street: event.target.value })} />
                  </Field>
                  <Field label="City">
                    <input disabled={isLocked("officeAddress")} className={inputClass} value={form.city} onChange={(event) => patch({ city: event.target.value })} />
                  </Field>
                  <Field label="State">
                    <input disabled={isLocked("officeAddress")} className={inputClass} value={form.state} onChange={(event) => patch({ state: event.target.value })} />
                  </Field>
                  <Field label="Postal code">
                    <input disabled={isLocked("officeAddress")} className={inputClass} value={form.postalCode} onChange={(event) => patch({ postalCode: event.target.value })} />
                  </Field>
                  <Field label="Country">
                    <input disabled={isLocked("officeAddress")} className={inputClass} value={form.country} onChange={(event) => patch({ country: event.target.value })} />
                  </Field>
                </div>
              </Section>
              <Section index="4" title="Add Sections" copy="Add a link, then drag the rows to set the order visitors see.">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {SERVICES.map((service) => {
                    const added = form.orderedLinks.some((item) => item.label === service.label);
                    return (
                      <button key={service.label} type="button" disabled={isLocked("socialLinks")} className={`rounded-2xl border px-3 py-3 text-left motion-safe:transition hover:-translate-y-0.5 hover:shadow disabled:opacity-50 ${added && !service.multiple ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"}`} onClick={() => addService(service)}>
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white"><SocialGlyph name={service.label} /></span>
                        <span className="mt-2 block text-sm font-semibold">{service.label}</span>
                        <span className="block text-xs text-slate-500">{added && !service.multiple ? "Added" : service.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <LinkList links={form.orderedLinks} disabled={isLocked("socialLinks")} onChange={setLinks} />
              </Section>
              <Section index="5" title="Card Appearance" copy="The theme is saved with this card. Text stays readable on every preset.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Background">
                    <span className="mt-1 flex items-center gap-2">
                      <input disabled={isLocked("cardTheme")} type="color" className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white" value={form.backgroundColor || "#1e1b4b"} onChange={(event) => patch({ backgroundColor: event.target.value })} />
                      <input disabled={isLocked("cardTheme")} className={inputClass} value={form.backgroundColor} placeholder="#1e1b4b" onChange={(event) => patch({ backgroundColor: event.target.value })} />
                    </span>
                  </Field>
                  <Field label="Accent">
                    <span className="mt-1 flex items-center gap-2">
                      <input disabled={isLocked("cardTheme")} type="color" className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white" value={form.accentColor || "#6d28d9"} onChange={(event) => patch({ accentColor: event.target.value })} />
                      <input disabled={isLocked("cardTheme")} className={inputClass} value={form.accentColor} placeholder="#6d28d9" onChange={(event) => patch({ accentColor: event.target.value })} />
                    </span>
                  </Field>
                </div>
                <Field label="Cover photo">
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <button type="button" disabled={isLocked("cardTheme")} className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => coverInput.current?.click()}>Upload cover</button>
                    {coverUrl ? <button type="button" className="text-sm text-slate-500" onClick={() => void removeCover()}>Remove cover</button> : null}
                  </span>
                  <input ref={coverInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void acceptCover(event.target.files?.[0]); event.target.value = ""; }} />
                </Field>
                <Field label="Profile photo position">
                  <span className="mt-1 block text-xs text-slate-500">Horizontal</span>
                  <input disabled={isLocked("photoKey")} type="range" min={0} max={100} value={form.photoFocusX} className="w-full accent-violet-700" onChange={(event) => patch({ photoFocusX: Number(event.target.value) })} />
                  <span className="mt-1 block text-xs text-slate-500">Vertical</span>
                  <input disabled={isLocked("photoKey")} type="range" min={0} max={100} value={form.photoFocusY} className="w-full accent-violet-700" onChange={(event) => patch({ photoFocusY: Number(event.target.value) })} />
                </Field>
                <button type="button" disabled={isLocked("cardTheme")} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => void restoreBranding()}>Restore default branding</button>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(Object.keys(THEME_PRESETS) as CardTheme[]).map((id) => {
                    const preset = THEME_PRESETS[id];
                    const selected = form.cardTheme === id;
                    return (
                      <button key={id} type="button" disabled={isLocked("cardTheme")} aria-pressed={selected} className={`rounded-2xl border p-2 text-left ${selected ? "border-violet-600 ring-2 ring-violet-600" : "border-slate-200"}`} onClick={() => patch({ cardTheme: id, backgroundColor: "", accentColor: "" })}>
                        <span className="block h-14 rounded-xl" style={{ background: preset.swatch }} />
                        <span className="mt-2 block text-sm font-semibold">{preset.label}</span>
                        <span className="block text-xs text-slate-500">{preset.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>
            </div>
          ) : null}
          {tab === "nfc" ? <NfcPanel profileUrl={profileUrl} nfcUrl={nfcUrl} owner={form.displayName} published={form.status === "active"} card={assigned} /> : null}
          {tab === "share" ? (
            <SharePanel
              url={profileUrl}
              slug={slug}
              qr={qr}
              title={form.displayName}
              vcardHref={form.status === "active" && form.publicProfileId ? `/api/public/business-cards/${form.publicProfileId}/contact.vcf` : undefined}
            />
          ) : null}
        </section>
      </div>
      {cropFile ? <PhotoCropDialog file={cropFile} onCancel={() => setCropFile(null)} onConfirm={(file) => void confirmCrop(file)} /> : null}
    </div>
  );
}

function LinkList({ links, disabled, onChange }: { links: SocialDraft[]; disabled: boolean; onChange: (links: SocialDraft[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  if (!links.length) return <p className="text-sm text-slate-500">No extra links yet.</p>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = links.findIndex((item) => item.id === active.id);
      const to = links.findIndex((item) => item.id === over.id);
      if (from < 0 || to < 0) return;
      onChange(arrayMove(links, from, to));
    }}>
      <SortableContext items={links.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {links.map((item) => (
            <SortableLink key={item.id} item={item} disabled={disabled} onChange={(next) => onChange(links.map((row) => row.id === item.id ? next : row))} onRemove={() => onChange(links.filter((row) => row.id !== item.id))} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableLink({ item, disabled, onChange, onRemove }: { item: SocialDraft; disabled: boolean; onChange: (item: SocialDraft) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id, disabled });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <button type="button" className="cursor-grab px-2 text-slate-400" aria-label={`Reorder ${item.label}`} {...attributes} {...listeners}>↕</button>
      <span className="w-24 shrink-0 text-sm font-semibold">{item.label}</span>
      <input disabled={disabled} className={inputClass} value={item.url} placeholder="https://" onChange={(event) => onChange({ ...item, url: event.target.value })} />
      <button type="button" className="rounded-xl px-2 text-sm text-slate-500" onClick={onRemove} disabled={disabled}>Remove</button>
    </li>
  );
}

function NfcPanel({ profileUrl, nfcUrl, owner, published, card }: { profileUrl: string; nfcUrl: string; owner: string; published: boolean; card?: NfcItem }) {
  const [tagQr, setTagQr] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(profileUrl, { width: 280, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } }).then(setTagQr);
  }, [profileUrl]);
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <p className="rounded-2xl bg-slate-50 p-3">A physical tag stores a stable https address. Updating this card does not require rewriting a tag that already points at it. Chrome on Android can write the sticker. iPhone Safari can open a written tag.</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Info label="Digital profile" value={published ? "Published" : "Private draft"} />
        <Info label="Card owner" value={owner || "Unnamed"} />
        <Info label="NFC tag" value={card ? card.status : "No tag assigned"} />
      </dl>
      <p className="break-all rounded-2xl bg-slate-50 p-3 font-mono text-xs">{nfcUrl}</p>
      {nfcUrl !== profileUrl ? <p>The published page is also at {profileUrl}. The tag keeps {nfcUrl}.</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {card ? <WriteNfcButton url={card.permanentUrl} /> : <p className="text-xs text-slate-500">An administrator assigns a tag before it can be written.</p>}
        <button type="button" className="rounded-full border border-slate-300 px-4 py-2 font-semibold" onClick={() => void navigator.clipboard.writeText(nfcUrl)}>Copy NFC URL</button>
        <a className="rounded-full border border-slate-300 px-4 py-2 font-semibold" href={nfcUrl} target="_blank" rel="noreferrer">Test link</a>
      </div>
      {tagQr ? <img alt="QR code for the NFC address" className="h-40 w-40 rounded-2xl border border-slate-200 bg-white p-2" src={tagQr} /> : null}
      <ol className="list-decimal space-y-1 pl-5">
        <li>Publish the card so the address shows the current contact details.</li>
        <li>An administrator writes the URL above to an NTAG213 from NFC Card Management.</li>
        <li>Tap the tag with a phone. It should open this same profile.</li>
      </ol>
    </div>
  );
}

function SharePanel({ url, slug, qr, title, vcardHref }: { url: string; slug: string; qr: string; title: string; vcardHref?: string }) {
  async function download(kind: "png" | "svg") {
    if (kind === "png") {
      const data = await QRCode.toDataURL(url, { width: 1200, margin: 2 });
      const link = document.createElement("a");
      link.href = data;
      link.download = `${slug || "card"}.png`;
      link.click();
      return;
    }
    const svg = await QRCode.toString(url, { type: "svg", margin: 2 });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    link.download = `${slug || "card"}.svg`;
    link.click();
  }
  const mail = `mailto:?subject=${encodeURIComponent(title || "Contact card")}&body=${encodeURIComponent(url)}`;
  const sms = `sms:?&body=${encodeURIComponent(url)}`;
  return (
    <div className="space-y-4 text-sm">
      {qr ? <img alt="QR code for the published card" className="h-40 w-40 rounded-2xl border border-slate-200 bg-white p-2" src={qr} /> : null}
      <p className="break-all rounded-2xl bg-slate-50 p-3 font-mono text-xs text-slate-600">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-full border border-slate-300 px-4 py-2 font-semibold" onClick={() => void navigator.clipboard.writeText(url)}>Copy link</button>
        <button type="button" className="rounded-full border border-slate-300 px-4 py-2 font-semibold" onClick={() => void download("png")}>Download QR</button>
        <button type="button" className="rounded-full border border-slate-300 px-4 py-2 font-semibold" onClick={() => void download("svg")}>Download SVG</button>
        {vcardHref ? <a className="rounded-full border border-slate-300 px-4 py-2 font-semibold" href={vcardHref}>Save Contact</a> : <span className="rounded-full border border-dashed border-slate-300 px-4 py-2 text-slate-500">Save Contact is available after publish</span>}
        <button type="button" className="rounded-full bg-violet-700 px-4 py-2 font-semibold text-white" onClick={() => void (navigator.share ? navigator.share({ url, title }) : navigator.clipboard.writeText(url))}>Share</button>
        <a className="rounded-full border border-slate-300 px-4 py-2 font-semibold" href={mail}>Email</a>
        <a className="rounded-full border border-slate-300 px-4 py-2 font-semibold" href={sms}>SMS</a>
      </div>
    </div>
  );
}

function Section({ index, title, copy, children }: { index: string; title: string; copy: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-700 text-xs font-semibold text-white">{index}</span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-slate-500">{copy}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children, required, locked }: { label: string; children: ReactNode; required?: boolean; locked?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}{required ? " *" : ""}{locked ? " · Locked" : ""}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NC";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function hydrate(profile: ApiProfile, raw: string | null): CardForm {
  const next = formFromProfile(profile);
  if (!raw) return next;
  try {
    const parsed = JSON.parse(raw) as Partial<CardForm>;
    const merged: CardForm = {
      ...next,
      ...parsed,
      version: profile.version,
      lockedFields: profile.lockedFields ?? next.lockedFields,
      profileId: profile.profileId,
      publicProfileId: profile.publicProfileId,
      status: profile.status,
      companyName: profile.companyName,
      website: profile.website ?? next.website,
      primaryEmail: next.primaryEmail,
    };
    if (!Array.isArray(parsed.orderedLinks)) merged.orderedLinks = legacyLinks(merged);
    return merged;
  } catch {
    return next;
  }
}

function legacyLinks(form: CardForm): SocialDraft[] {
  const rows: SocialDraft[] = [];
  if (form.linkedin) rows.push({ id: "linkedin", type: "linkedin", label: "LinkedIn", url: form.linkedin, public: form.linkedinPublic });
  if (form.calendar) rows.push({ id: "calendar", type: "calendar", label: "Calendar", url: form.calendar, public: form.calendarPublic });
  for (const [index, extra] of form.extras.entries()) {
    rows.push({ id: `extra-${index}`, type: "custom", label: extra.label || "Link", url: extra.url, public: extra.public });
  }
  return rows;
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\n|\r/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function downloadDraftVCard(form: CardForm) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(form.displayName || "Contact")}`,
    `ORG:${escapeVCard(form.companyName || "NexCort iQ")}`,
  ];
  if (form.title) lines.push(`TITLE:${escapeVCard(form.title)}`);
  if (form.department) lines.push(`ROLE:${escapeVCard(form.department)}`);
  if (form.mobile) lines.push(`TEL;TYPE=CELL:${form.mobile}`);
  if (form.primaryEmail) lines.push(`EMAIL:${escapeVCard(form.primaryEmail)}`);
  if (form.website) lines.push(`URL:${escapeVCard(form.website)}`);
  for (const link of form.orderedLinks) {
    if (link.url.startsWith("https://") && link.url.length > "https://".length) lines.push(`URL:${escapeVCard(link.url)}`);
  }
  const address = [form.street, form.city, form.state, form.postalCode, form.country].some(Boolean);
  if (address) {
    lines.push(`ADR;TYPE=WORK:;;${escapeVCard(form.street)};${escapeVCard(form.city)};${escapeVCard(form.state)};${escapeVCard(form.postalCode)};${escapeVCard(form.country)}`);
  }
  lines.push("END:VCARD");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/vcard" }));
  link.download = "contact.vcf";
  link.click();
}

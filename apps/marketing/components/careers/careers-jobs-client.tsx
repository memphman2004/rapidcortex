"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { careersApiBase, fetchPublishedRoles } from "@/lib/careers/fetch-postings";
import type { OpenRole } from "@/lib/careers/open-roles";
import { OPEN_ROLES } from "@/lib/careers/open-roles";

type Step = "idle" | "form" | "uploading" | "submitting" | "success" | "error";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedInUrl: string;
  yearsExperience: string;
  weeklyAvailability: string;
  coverNote: string;
}

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedInUrl: "",
  yearsExperience: "",
  weeklyAvailability: "",
  coverNote: "",
};

async function getPresignedUploadUrl(fileName: string, contentType: string) {
  const res = await fetch(`${careersApiBase()}/api/careers/presigned-upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName, contentType }),
  });
  if (!res.ok) throw new Error("Failed to get upload URL");
  return res.json() as Promise<{ uploadUrl: string; resumeKey: string }>;
}

async function submitApplication(
  role: OpenRole,
  body: FormState & { resumeKey: string; resumeFileName: string },
) {
  const res = await fetch(`${careersApiBase()}/api/careers/apply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...body,
      position: role.positionCode,
      source: "CAREERS_PAGE",
      linkedInUrl: body.linkedInUrl.trim() || undefined,
      phone: body.phone.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Submission failed");
  }
  return res.json();
}

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-200">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40";

function JobListCard({
  role,
  selected,
  onSelect,
}: {
  role: OpenRole;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-xl border px-4 py-4 text-left transition",
        selected
          ? "border-sky-500/60 bg-sky-500/10 shadow-[inset_3px_0_0_0_rgb(14,165,233)]"
          : "border-slate-800 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-900/70",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-bold tracking-wide text-sky-300">
          RC
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white">{role.title}</h2>
          <p className="mt-0.5 truncate text-sm text-slate-300">{role.company}</p>
          <p className="mt-0.5 truncate text-sm text-slate-500">{role.location}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {role.chips.slice(0, 3).map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400"
              >
                {chip}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-emerald-400/90">{role.postedLabel}</p>
        </div>
      </div>
    </button>
  );
}

function JobDetail({
  role,
  onBack,
}: {
  role: OpenRole;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const applyRef = useRef<HTMLDivElement>(null);

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const valid =
    form.firstName.trim() &&
    form.lastName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.coverNote.trim().length >= 20 &&
    resumeFile !== null;

  function openApply() {
    setStep("form");
    setTimeout(() => applyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !resumeFile) return;
    setErrorMsg("");

    try {
      setStep("uploading");
      const { uploadUrl, resumeKey } = await getPresignedUploadUrl(
        resumeFile.name,
        resumeFile.type || "application/pdf",
      );

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed"));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", resumeFile.type || "application/pdf");
        // Must match PutObjectCommand ServerSideEncryption on the presigned URL.
        xhr.setRequestHeader("x-amz-server-side-encryption", "AES256");
        xhr.send(resumeFile);
      });

      setStep("submitting");
      await submitApplication(role, {
        ...form,
        resumeKey,
        resumeFileName: resumeFile.name,
      });
      setStep("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-400">
          ✓
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">Application submitted</h2>
        <p className="mb-1 max-w-md text-slate-400">
          Thank you, {form.firstName}. We received your application for{" "}
          <span className="text-sky-300">{role.title}</span>.
        </p>
        <p className="max-w-md text-sm text-slate-500">
          Questions:{" "}
          <a href="mailto:careers@rapidcortex.us" className="text-sky-400 hover:text-sky-300">
            careers@rapidcortex.us
          </a>
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-8 rounded-full border border-slate-700 px-5 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
        >
          Back to jobs
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-sky-300 lg:hidden"
      >
        ← All jobs
      </button>

      <div className="rounded-xl border border-slate-800 bg-[#0a1428] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-sm font-bold tracking-wide text-sky-300">
            RC
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              {role.title}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {role.company} · {role.location}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {role.workplaceType} · {role.employmentType} · {role.compensation} · {role.hours}
            </p>
            <p className="mt-2 text-xs text-emerald-400/90">
              {role.postedLabel} · {role.applicantsLabel}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openApply}
            className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Easy Apply
          </button>
          <a
            href="mailto:careers@rapidcortex.us"
            className="rounded-full border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-400"
          >
            Save for later
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {role.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-white">About the job</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
          {role.about.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </div>

        <h3 className="mt-8 text-base font-semibold text-white">Responsibilities</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          {role.responsibilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h3 className="mt-8 text-base font-semibold text-white">Requirements</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          {role.requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h3 className="mt-8 text-base font-semibold text-white">Nice to have</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          {role.niceToHave.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="mt-8 border-t border-slate-800 pt-5 text-sm text-slate-500">
          Apps on Demand LLC d/b/a Rapid Cortex ·{" "}
          <Link href="/privacy" className="text-sky-400 hover:text-sky-300">
            Privacy policy
          </Link>{" "}
          ·{" "}
          <a href="mailto:careers@rapidcortex.us" className="text-sky-400 hover:text-sky-300">
            careers@rapidcortex.us
          </a>
        </div>
      </section>

      {(step === "form" || step === "uploading" || step === "submitting" || step === "error") && (
        <div ref={applyRef} className="rounded-xl border border-slate-800 bg-[#0a1428]">
          <div className="border-b border-slate-800 px-5 py-4 sm:px-7">
            <h2 className="text-base font-semibold text-white">Easy Apply · {role.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Resume required. Fields marked * are required.
            </p>
          </div>

          {step === "uploading" || step === "submitting" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-4 py-14 text-center">
              <div className="h-1.5 w-64 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: step === "submitting" ? "100%" : `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400">
                {step === "uploading"
                  ? `Uploading resume… ${uploadProgress}%`
                  : "Submitting your application…"}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-7">
              {step === "error" ? (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {errorMsg}
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First name" required>
                  <input
                    className={inputCls}
                    value={form.firstName}
                    onChange={set("firstName")}
                    placeholder="Jane"
                    required
                  />
                </Field>
                <Field label="Last name" required>
                  <input
                    className={inputCls}
                    value={form.lastName}
                    onChange={set("lastName")}
                    placeholder="Smith"
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Email" required>
                  <input
                    className={inputCls}
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="jane@example.com"
                    required
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className={inputCls}
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="(555) 000-0000"
                  />
                </Field>
              </div>

              <Field label="LinkedIn profile URL" hint="e.g. linkedin.com/in/yourname">
                <input
                  className={inputCls}
                  value={form.linkedInUrl}
                  onChange={set("linkedInUrl")}
                  placeholder="https://linkedin.com/in/yourname"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Years of experience">
                  <select
                    className={inputCls}
                    value={form.yearsExperience}
                    onChange={set("yearsExperience")}
                  >
                    <option value="">Select…</option>
                    <option value="0-1">Less than 1 year</option>
                    <option value="1-3">1–3 years</option>
                    <option value="3-5">3–5 years</option>
                    <option value="5-10">5–10 years</option>
                    <option value="10+">10+ years</option>
                  </select>
                </Field>
                <Field label="Weekly availability">
                  <select
                    className={inputCls}
                    value={form.weeklyAvailability}
                    onChange={set("weeklyAvailability")}
                  >
                    <option value="">Select…</option>
                    <option value="5-10">5–10 hrs/week</option>
                    <option value="10-15">10–15 hrs/week</option>
                    <option value="15-20">15–20 hrs/week</option>
                    <option value="20+">20+ hrs/week</option>
                  </select>
                </Field>
              </div>

              <Field
                label="Why are you a great fit?"
                required
                hint="2–4 sentences about your experience and interest in Rapid Cortex."
              >
                <textarea
                  className={`${inputCls} min-h-[120px] resize-y`}
                  value={form.coverNote}
                  onChange={set("coverNote")}
                  placeholder="Tell us what makes you the right person for this role…"
                  required
                  minLength={20}
                />
              </Field>

              <Field label="Resume" required hint="PDF, DOCX, or DOC — max 10 MB">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
                  }}
                  className={[
                    "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-8 transition",
                    resumeFile
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-slate-700 bg-slate-950/40 hover:border-sky-500/50 hover:bg-sky-500/5",
                  ].join(" ")}
                >
                  {resumeFile ? (
                    <>
                      <div className="text-sm font-medium text-emerald-400">{resumeFile.name}</div>
                      <div className="text-xs text-slate-500">
                        {(resumeFile.size / 1024).toFixed(0)} KB · Click to replace
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm text-slate-300">Upload your resume</div>
                      <div className="text-xs text-slate-500">PDF, DOCX, or DOC · Max 10 MB</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size <= 10 * 1024 * 1024) setResumeFile(f);
                    else if (f) alert("File exceeds 10 MB limit.");
                  }}
                />
              </Field>

              <p className="text-xs leading-relaxed text-slate-500">
                By submitting, you agree Rapid Cortex (Apps on Demand LLC) may use your information to
                evaluate your candidacy. See our{" "}
                <Link href="/privacy" className="text-sky-400 hover:text-sky-300">
                  Privacy policy
                </Link>
                .
              </p>

              <button
                type="submit"
                disabled={!valid}
                className={[
                  "w-full rounded-full py-3 text-sm font-semibold transition",
                  valid
                    ? "bg-sky-600 text-white hover:bg-sky-500"
                    : "cursor-not-allowed bg-slate-800 text-slate-500",
                ].join(" ")}
              >
                Submit application
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function CareersJobsClient() {
  const [roles, setRoles] = useState<OpenRole[]>(OPEN_ROLES);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fetched = await fetchPublishedRoles();
      if (cancelled) return;
      setRoles(fetched);
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("slug")?.trim() ?? "";
      const fromHash = window.location.hash.replace(/^#/, "").trim();
      const preferred = fromQuery || fromHash;
      if (preferred && fetched.some((r) => r.id === preferred)) {
        setSelectedId(preferred);
        return;
      }
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setSelectedId(fetched[0]?.id ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      if (window.location.hash) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      return;
    }
    if (window.location.hash !== `#${selectedId}`) {
      history.replaceState(null, "", `#${selectedId}`);
    }
  }, [selectedId]);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Careers</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Jobs at Rapid Cortex
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {loading
            ? "Loading open roles…"
            : `${roles.length} open ${roles.length === 1 ? "role" : "roles"}`}{" "}
          · Apps on Demand LLC d/b/a Rapid Cortex ·{" "}
          <a href="mailto:careers@rapidcortex.us" className="text-sky-400 hover:text-sky-300">
            careers@rapidcortex.us
          </a>
        </p>
      </header>

      {!loading && roles.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-12 text-center">
          <p className="text-slate-400">No open positions at the moment.</p>
          <p className="mt-2 text-sm text-slate-500">
            Check back soon or connect with us on{" "}
            <a
              href="https://www.linkedin.com/company/rapidcortex"
              className="text-sky-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          <aside className={["space-y-3", selected ? "hidden lg:block" : "block"].join(" ")}>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <p className="text-sm font-medium text-white">Open roles</p>
              <p className="text-xs text-slate-500">Select a job to view details</p>
            </div>
            {roles.map((role) => (
              <JobListCard
                key={role.id}
                role={role}
                selected={selectedId === role.id}
                onSelect={() => setSelectedId(role.id)}
              />
            ))}
          </aside>

          <main className={selected ? "block" : "hidden lg:block"}>
            {selected ? (
              <JobDetail key={selected.id} role={selected} onBack={() => setSelectedId(null)} />
            ) : (
              <div className="flex min-h-[28rem] items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30 px-6 text-center text-sm text-slate-500">
                Select a job on the left to view the description and apply.
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

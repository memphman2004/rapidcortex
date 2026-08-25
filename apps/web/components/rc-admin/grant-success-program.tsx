"use client";

// RC Grant Success Program — unified grant writer wizard
// 4-step wizard that collects agency + grant + project details,
// then calls Claude server-side and downloads a .docx grant response.
//
// Replaces both the old Grant Success Program (school safety focus)
// and the standalone Grant Writer page (flat form).
// Single nav entry: Grants → Grant Success Program tab.

import { useState, type ReactNode } from "react";

interface GrantForm {
  agencyName: string;
  agencyType: string;
  agencyCity: string;
  agencyState: string;
  agencyPopulation: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;

  grantName: string;
  fundingAgency: string;
  grantNumber: string;
  requestedAmount: string;
  deadline: string;
  projectPeriod: string;

  projectTitle: string;
  projectDescription: string;
  problemStatement: string;
  staffingChallenge: string;
  existingTechnology: string;
  rcModules: string[];
  additionalContext: string;
}

const INITIAL_FORM: GrantForm = {
  agencyName: "",
  agencyType: "",
  agencyCity: "",
  agencyState: "",
  agencyPopulation: "",
  contactName: "",
  contactTitle: "",
  contactEmail: "",
  grantName: "",
  fundingAgency: "",
  grantNumber: "",
  requestedAmount: "",
  deadline: "",
  projectPeriod: "",
  projectTitle: "",
  projectDescription: "",
  problemStatement: "",
  staffingChallenge: "",
  existingTechnology: "",
  rcModules: [],
  additionalContext: "",
};

const STEPS = [
  { number: 1, label: "Agency profile" },
  { number: 2, label: "Grant opportunity" },
  { number: 3, label: "Project details" },
  { number: 4, label: "Review & generate" },
];

const AGENCY_TYPES = [
  "911 / Emergency Communications Center (ECC)",
  "County Sheriff's Office",
  "Municipal Police Department",
  "Fire & Rescue",
  "EMS / Emergency Medical Services",
  "Emergency Management Agency",
  "Combined PSAP",
  "University / Campus Public Safety",
];

const GRANT_PROGRAMS = [
  "COPS Technology Program",
  "PSAP NG911 Grant Program",
  "Edward Byrne Memorial JAG",
  "FEMA Homeland Security Grant Program",
  "ARPA / SLFRF",
  "State Criminal Justice Grant",
  "Congressionally Directed Spending (CDS)",
  "Other / Custom",
];

const RC_MODULES = [
  "AI Dispatch Transcription",
  "Supervisor Intelligence Dashboard",
  "QA & Coaching Automation",
  "Incident Command",
  "Silent Text / Caller Media",
  "CAD Integration",
  "Live Camera Integration",
  "Multi-Language Translation",
  "Post-Incident Review",
  "Analytics & Reporting",
];

/** Format grant amount as USD whole dollars, e.g. 254254 → "$254,254". */
function formatUsdAmount(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

const input =
  "w-full bg-transparent border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 transition-colors";
const textarea = `${input} resize-none`;
const label = "block text-xs font-medium text-white/60 mb-1.5";

function F({
  l,
  required,
  children,
  hint,
  half,
}: {
  l: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  half?: boolean;
}) {
  return (
    <div className={half ? "col-span-1" : ""}>
      <label className={label}>
        {l}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-white/30">{hint}</p>}
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-shrink-0 items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                step.number === current
                  ? "bg-violet-500 text-white"
                  : step.number < current
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/30"
              }`}
            >
              {step.number < current ? "✓" : step.number}
            </div>
            <span
              className={`text-xs transition-colors ${
                step.number === current
                  ? "font-medium text-white"
                  : step.number < current
                    ? "text-white/50"
                    : "text-white/20"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`mx-4 h-px flex-1 transition-colors ${
                step.number < current ? "bg-white/20" : "bg-white/5"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 rounded-xl border border-white/8 bg-white/[0.03] p-6">
      <div className="mb-5">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label: l, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between border-b border-white/5 py-2.5 last:border-0">
      <span className="w-44 flex-shrink-0 text-xs text-white/40">{l}</span>
      <span className="flex-1 text-right text-xs text-white/80">{value}</span>
    </div>
  );
}

export function GrantSuccessProgram() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<GrantForm>(INITIAL_FORM);
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState("");

  function set(field: keyof GrantForm, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function toggleModule(m: string) {
    setForm((p) => ({
      ...p,
      rcModules: p.rcModules.includes(m)
        ? p.rcModules.filter((x) => x !== m)
        : [...p.rcModules, m],
    }));
  }

  function canAdvance(): boolean {
    if (step === 1) return Boolean(form.agencyName && form.agencyType);
    if (step === 2) return Boolean(form.grantName);
    if (step === 3) return Boolean(form.projectDescription);
    return true;
  }

  async function generate() {
    setStatus("generating");
    setErrorMsg(null);
    setProgressMessage("Sending to Claude — writing grant narrative…");

    try {
      const res = await fetch("/api/rc-admin/grant-writer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requestedAmount: formatUsdAmount(form.requestedAmount),
        }),
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(body.message ?? body.error ?? `Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let currentData = "";
      let gotComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6).trim();
          } else if (line === "" && currentEvent && currentData) {
            const payload = JSON.parse(currentData) as Record<string, unknown>;

            if (currentEvent === "progress") {
              setProgressMessage(String(payload.message ?? ""));
            }

            if (currentEvent === "error") {
              throw new Error(String(payload.message ?? "Generation failed"));
            }

            if (currentEvent === "complete") {
              const base64 = String(payload.base64);
              const filename = String(payload.filename ?? "grant-response.docx");
              const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
              const blob = new Blob([bytes], {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              });

              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              gotComplete = true;
              setStatus("done");
              setProgressMessage("");
            }

            currentEvent = "";
            currentData = "";
          }
        }
      }

      if (!gotComplete) {
        throw new Error("Generation ended before the document was ready. Please try again.");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message || "Failed to generate grant response.");
      setProgressMessage("");
    }
  }

  const isBusy = status === "generating";

  return (
    <div>
      <div className="mb-2">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-lg">✦</span>
          <h2 className="text-sm font-semibold text-white">Grant Success Program</h2>
        </div>
        <p className="text-xs text-white/40">
          Generate a fully customized grant application package — executive summary, problem
          statement, itemized budget, implementation timeline, and paste-ready grant language.
          Downloads as a Word document (.docx) ready for submission.
        </p>
      </div>

      <div className="mt-6">
        <StepIndicator current={step} />

        {step === 1 && (
          <>
            <Section
              title="Agency profile"
              subtitle="Basic information about the agency we're preparing this grant package for"
            >
              <div className="grid grid-cols-2 gap-4">
                <F l="Agency name" required>
                  <input
                    value={form.agencyName}
                    onChange={(e) => set("agencyName", e.target.value)}
                    placeholder="e.g. Cortex County Sheriff's Office"
                    className={input}
                  />
                </F>
                <F l="Agency type" required>
                  <select
                    value={form.agencyType}
                    onChange={(e) => set("agencyType", e.target.value)}
                    className={input}
                  >
                    <option value="" className="bg-slate-900">
                      Select type…
                    </option>
                    {AGENCY_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-slate-900">
                        {t}
                      </option>
                    ))}
                  </select>
                </F>
                <F l="City" half>
                  <input
                    value={form.agencyCity}
                    onChange={(e) => set("agencyCity", e.target.value)}
                    placeholder="e.g. Rapid Cortex"
                    className={input}
                  />
                </F>
                <F l="State" half>
                  <input
                    value={form.agencyState}
                    onChange={(e) => set("agencyState", e.target.value)}
                    placeholder="e.g. Delaware"
                    className={input}
                  />
                </F>
                <F l="Service population" half>
                  <input
                    value={form.agencyPopulation}
                    onChange={(e) => set("agencyPopulation", e.target.value)}
                    placeholder="e.g. 34,854"
                    className={input}
                  />
                </F>
              </div>
            </Section>

            <Section title="Authorized representative">
              <div className="grid grid-cols-3 gap-4">
                <F l="Full name">
                  <input
                    value={form.contactName}
                    onChange={(e) => set("contactName", e.target.value)}
                    className={input}
                  />
                </F>
                <F l="Title">
                  <input
                    value={form.contactTitle}
                    onChange={(e) => set("contactTitle", e.target.value)}
                    placeholder="e.g. 911 Director"
                    className={input}
                  />
                </F>
                <F l="Email">
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => set("contactEmail", e.target.value)}
                    className={input}
                  />
                </F>
              </div>
            </Section>
          </>
        )}

        {step === 2 && (
          <Section
            title="Grant opportunity"
            subtitle="Details about the grant program this package is being prepared for"
          >
            <div className="grid grid-cols-2 gap-4">
              <F l="Grant program / name" required>
                <input
                  list="grant-programs"
                  value={form.grantName}
                  onChange={(e) => set("grantName", e.target.value)}
                  placeholder="e.g. COPS Technology Program"
                  className={input}
                />
                <datalist id="grant-programs">
                  {GRANT_PROGRAMS.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </F>
              <F l="Funding agency">
                <input
                  value={form.fundingAgency}
                  onChange={(e) => set("fundingAgency", e.target.value)}
                  placeholder="e.g. U.S. Department of Justice"
                  className={input}
                />
              </F>
              <F l="Grant / solicitation number">
                <input
                  value={form.grantNumber}
                  onChange={(e) => set("grantNumber", e.target.value)}
                  placeholder="e.g. O-COPS-2026-171368"
                  className={input}
                />
              </F>
              <F l="Amount requested">
                <input
                  inputMode="numeric"
                  value={form.requestedAmount}
                  onChange={(e) => set("requestedAmount", formatUsdAmount(e.target.value))}
                  placeholder="e.g. $254,254"
                  className={input}
                />
              </F>
              <F l="Application deadline">
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                  className={input}
                />
              </F>
              <F l="Project period">
                <input
                  value={form.projectPeriod}
                  onChange={(e) => set("projectPeriod", e.target.value)}
                  placeholder="e.g. 24 months / Oct 2026 – Sep 2028"
                  className={input}
                />
              </F>
            </div>
          </Section>
        )}

        {step === 3 && (
          <>
            <Section
              title="Project details"
              subtitle="Describe what Rapid Cortex capabilities are being requested and why"
            >
              <div className="grid gap-4">
                <F l="Project title">
                  <input
                    value={form.projectTitle}
                    onChange={(e) => set("projectTitle", e.target.value)}
                    placeholder="e.g. AI-Powered Emergency Communications Intelligence System"
                    className={input}
                  />
                </F>
                <F
                  l="Project description / scope of work"
                  required
                  hint="Describe what you plan to purchase and implement. More detail produces a stronger narrative."
                >
                  <textarea
                    value={form.projectDescription}
                    onChange={(e) => set("projectDescription", e.target.value)}
                    rows={5}
                    placeholder="Describe the technology being procured, implementation plan, and expected outcomes…"
                    className={textarea}
                  />
                </F>
                <F
                  l="Problem statement / statement of need"
                  hint="Staffing shortages, outdated technology, call volume challenges, dispatcher burnout…"
                >
                  <textarea
                    value={form.problemStatement}
                    onChange={(e) => set("problemStatement", e.target.value)}
                    rows={4}
                    placeholder="e.g. Our dispatch center operates with a 30% vacancy rate and relies on a 2008 CAD system…"
                    className={textarea}
                  />
                </F>
                <div className="grid grid-cols-2 gap-4">
                  <F l="Staffing / workforce challenge">
                    <input
                      value={form.staffingChallenge}
                      onChange={(e) => set("staffingChallenge", e.target.value)}
                      placeholder="e.g. 4 of 12 positions vacant, avg. call processing 45s"
                      className={input}
                    />
                  </F>
                  <F l="Existing technology being replaced or augmented">
                    <input
                      value={form.existingTechnology}
                      onChange={(e) => set("existingTechnology", e.target.value)}
                      placeholder="e.g. Tyler Technologies New World CAD (2019)"
                      className={input}
                    />
                  </F>
                </div>
              </div>
            </Section>

            <Section
              title="Rapid Cortex modules being requested"
              subtitle="Select all modules included in this grant request"
            >
              <div className="grid grid-cols-2 gap-2">
                {RC_MODULES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleModule(m)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                      form.rcModules.includes(m)
                        ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                        : "border-white/8 bg-white/[0.03] text-white/50 hover:border-white/15"
                    }`}
                  >
                    <div
                      className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                        form.rcModules.includes(m)
                          ? "border-violet-500 bg-violet-500"
                          : "border-white/20"
                      }`}
                    >
                      {form.rcModules.includes(m) && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path
                            d="M1 3l2 2 4-4"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    {m}
                  </button>
                ))}
              </div>
            </Section>

            <Section
              title="Additional context"
              subtitle="Optional — anything else that should inform the grant narrative"
            >
              <textarea
                value={form.additionalContext}
                onChange={(e) => set("additionalContext", e.target.value)}
                rows={3}
                placeholder="Past grants received, partnerships, geographic considerations, prior incidents, community impact data…"
                className={textarea}
              />
            </Section>
          </>
        )}

        {step === 4 && (
          <>
            <Section title="Agency profile">
              <ReviewRow label="Agency name" value={form.agencyName} />
              <ReviewRow label="Agency type" value={form.agencyType} />
              <ReviewRow
                label="Location"
                value={[form.agencyCity, form.agencyState].filter(Boolean).join(", ")}
              />
              <ReviewRow label="Population served" value={form.agencyPopulation} />
              <ReviewRow
                label="Contact"
                value={[form.contactName, form.contactTitle].filter(Boolean).join(" · ")}
              />
            </Section>

            <Section title="Grant opportunity">
              <ReviewRow label="Grant program" value={form.grantName} />
              <ReviewRow label="Funding agency" value={form.fundingAgency} />
              <ReviewRow label="Solicitation number" value={form.grantNumber} />
              <ReviewRow label="Amount requested" value={formatUsdAmount(form.requestedAmount)} />
              <ReviewRow label="Deadline" value={form.deadline} />
              <ReviewRow label="Project period" value={form.projectPeriod} />
            </Section>

            <Section title="Project details">
              <ReviewRow label="Project title" value={form.projectTitle} />
              <ReviewRow label="RC modules" value={form.rcModules.join(", ")} />
              <ReviewRow label="Existing technology" value={form.existingTechnology} />
              <ReviewRow label="Staffing challenge" value={form.staffingChallenge} />
            </Section>

            {status === "generating" && (
              <div className="mb-4 rounded-xl border border-white/8 bg-white/[0.03] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                  <div>
                    <p className="text-sm text-white/80">
                      {progressMessage || "Generating grant response…"}
                    </p>
                    <p className="mt-0.5 text-xs text-white/30">
                      Generating Agency grant response. This usually takes a little while — please
                      Do not close this page.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === "done" && (
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
                <p className="text-sm font-medium text-emerald-400">✓ Grant package downloaded</p>
                <p className="mt-0.5 text-xs text-emerald-400/60">
                  Your Word document has been saved to your Downloads folder and is ready for review
                  and submission.
                </p>
              </div>
            )}

            {status === "error" && errorMsg && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4">
                <p className="text-sm font-medium text-red-400">Generation failed</p>
                <p className="mt-0.5 text-xs text-red-400/60">{errorMsg}</p>
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || isBusy}
            className="px-4 py-2 text-sm text-white/50 transition-colors hover:text-white/80 disabled:opacity-30"
          >
            ← Back
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="rounded-lg bg-white/8 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (status === "done") setStatus("idle");
                void generate();
              }}
              disabled={isBusy}
              className="rounded-lg bg-violet-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy
                ? "Generating…"
                : status === "done"
                  ? "Generate another →"
                  : "Generate & download .docx →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

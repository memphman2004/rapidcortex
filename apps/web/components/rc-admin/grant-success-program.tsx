"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  GRANT_PROGRAM_IDS,
  GRANT_PROGRAM_LABELS,
  GRANT_SCHOOL_TYPE_IDS,
  GRANT_SCHOOL_TYPE_LABELS,
  type GrantPackage,
  type GrantProgramId,
  type GrantSchoolTypeId,
} from "rapid-cortex-shared";

type FormState = {
  schoolName: string;
  schoolType: GrantSchoolTypeId;
  city: string;
  state: string;
  studentPopulation: string;
  campusCount: string;
  buildingCount: string;
  residenceHalls: string;
  campusPolice: "yes" | "contract" | "no";
  officerCount: string;
  existingENS: string;
  blueLight: "yes" | "no";
  blueLightCount: string;
  accessControl: "yes" | "partial" | "no";
  cameraCount: string;
  cadSystem: "yes" | "no";
  reportingProcess: string;
  mutualAid: string;
  safetyConcerns: string;
  grantPrograms: GrantProgramId[];
  grantAmount: string;
  projectPeriod: "12" | "18" | "24" | "36";
  additionalContext: string;
};

const BLANK_FORM: FormState = {
  schoolName: "",
  schoolType: "university",
  city: "",
  state: "",
  studentPopulation: "",
  campusCount: "1",
  buildingCount: "",
  residenceHalls: "0",
  campusPolice: "yes",
  officerCount: "",
  existingENS: "",
  blueLight: "yes",
  blueLightCount: "",
  accessControl: "yes",
  cameraCount: "",
  cadSystem: "no",
  reportingProcess: "",
  mutualAid: "",
  safetyConcerns: "",
  grantPrograms: [],
  grantAmount: "",
  projectPeriod: "12",
  additionalContext: "",
};

const NAV_SECTIONS = [
  { id: "executive", label: "Executive summary" },
  { id: "problem", label: "Problem statement" },
  { id: "narrative", label: "Project narrative" },
  { id: "technology", label: "Technology description" },
  { id: "budget", label: "Budget" },
  { id: "justification", label: "Budget justification" },
  { id: "timeline", label: "Implementation timeline" },
  { id: "cybersecurity", label: "Cybersecurity & compliance" },
  { id: "sustainability", label: "Sustainability plan" },
  { id: "evaluation", label: "Evaluation plan" },
  { id: "outcomes", label: "Expected outcomes" },
] as const;
type SectionId = (typeof NAV_SECTIONS)[number]["id"];

const STEP_LABELS = ["School profile", "Safety infrastructure", "Grant program", "Review & generate"];

const inputClass =
  "w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-600";
const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export function GrantSuccessProgram() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({ ...BLANK_FORM });
  const [grantData, setGrantData] = useState<GrantPackage | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("executive");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleProgram(id: GrantProgramId) {
    setForm((prev) => ({
      ...prev,
      grantPrograms: prev.grantPrograms.includes(id)
        ? prev.grantPrograms.filter((x) => x !== id)
        : [...prev.grantPrograms, id],
    }));
  }

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/grant-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const detail = body.error?.trim();
        throw new Error(
          detail ||
            (res.status === 503
              ? "Generation timed out — retry in a moment"
              : `HTTP ${res.status}`),
        );
      }
      return (await res.json()) as GrantPackage;
    },
    onSuccess: (data) => {
      setGrantData(data);
      setActiveSection("executive");
    },
  });

  function reset() {
    setGrantData(null);
    setStep(1);
    setForm({ ...BLANK_FORM });
    generate.reset();
  }

  const stepValid =
    step === 1
      ? Boolean(form.schoolName.trim() && form.city.trim() && form.state.trim() && form.studentPopulation.trim())
      : step === 3
        ? form.grantPrograms.length > 0
        : true;

  if (generate.isPending) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-slate-800 bg-slate-950/50 px-6 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-sky-500" />
        <p className="text-sm font-semibold text-white">Generating grant package…</p>
        <p className="text-xs text-slate-500">Customizing for {form.schoolName} · 20–40 seconds</p>
      </div>
    );
  }

  if (grantData) {
    return (
      <GrantResult
        form={form}
        grantData={grantData}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onReset={reset}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-sky-900/60 bg-sky-950/20 px-4 py-3">
        <span className="text-lg">🎓</span>
        <div>
          <p className="text-sm font-semibold text-sky-300">Grant Success Program</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Generate a fully customized grant application package for schools, campuses, or city / county / state
            agencies — executive summary, problem statement, itemized budget, implementation timeline, and
            paste-ready grant language. No additional cost to the customer.
          </p>
        </div>
      </div>

      <ol className="flex items-center gap-2 text-xs text-slate-500">
        {STEP_LABELS.map((label, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  done
                    ? "border-sky-600 bg-sky-600 text-white"
                    : active
                      ? "border-sky-500 bg-sky-950 text-sky-300"
                      : "border-slate-700 bg-slate-900 text-slate-500"
                }`}
              >
                {done ? "✓" : num}
              </span>
              <span className={active ? "font-medium text-slate-200" : ""}>{label}</span>
              {i < STEP_LABELS.length - 1 && <span className="h-px flex-1 bg-slate-800" />}
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">{STEP_LABELS[step - 1]}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {step === 1 && "Basic information about the school, city, county, or state agency we're preparing a package for"}
            {step === 2 && "Current safety technology and infrastructure on campus"}
            {step === 3 && "Grant programs and funding parameters"}
            {step === 4 && "Confirm all details and generate the customized package"}
          </p>
        </div>

        {step === 1 && <Step1 form={form} update={update} />}
        {step === 2 && <Step2 form={form} update={update} />}
        {step === 3 && <Step3 form={form} update={update} toggleProgram={toggleProgram} />}
        {step === 4 && (
          <ReviewStep form={form} error={generate.error as Error | null} onGenerate={() => generate.mutate()} />
        )}

        {step < 4 ? (
          <div className="mt-5 flex justify-between border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="rounded border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => stepValid && setStep((s) => s + 1)}
              disabled={!stepValid}
              className="rounded bg-sky-600 px-5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              Continue →
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setStep(3)}
            className="mt-4 rounded border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

function Radio<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded border px-3 py-2 text-xs font-medium ${
            value === o.value
              ? "border-sky-600 bg-sky-950/40 text-sky-300"
              : "border-slate-700 bg-transparent text-slate-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Step1({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Institution name *</label>
          <input
            className={inputClass}
            placeholder="University of Georgia"
            value={form.schoolName}
            onChange={(e) => update("schoolName", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Institution type *</label>
          <select
            className={inputClass}
            value={form.schoolType}
            onChange={(e) => update("schoolType", e.target.value as GrantSchoolTypeId)}
          >
            {GRANT_SCHOOL_TYPE_IDS.map((id) => (
              <option key={id} value={id}>
                {GRANT_SCHOOL_TYPE_LABELS[id]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>City *</label>
          <input className={inputClass} placeholder="Athens" value={form.city} onChange={(e) => update("city", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>State *</label>
          <input className={inputClass} placeholder="GA" value={form.state} onChange={(e) => update("state", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Student population *</label>
          <input
            className={inputClass}
            type="number"
            placeholder="38000"
            value={form.studentPopulation}
            onChange={(e) => update("studentPopulation", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Campuses</label>
          <input
            className={inputClass}
            type="number"
            placeholder="1"
            value={form.campusCount}
            onChange={(e) => update("campusCount", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Buildings on campus</label>
          <input
            className={inputClass}
            type="number"
            placeholder="120"
            value={form.buildingCount}
            onChange={(e) => update("buildingCount", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Residence halls</label>
          <input
            className={inputClass}
            type="number"
            placeholder="24"
            value={form.residenceHalls}
            onChange={(e) => update("residenceHalls", e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Campus police / security</label>
        <Radio
          value={form.campusPolice}
          onChange={(v) => update("campusPolice", v)}
          options={[
            { value: "yes", label: "Dedicated campus police" },
            { value: "contract", label: "Contract security" },
            { value: "no", label: "No campus police" },
          ]}
        />
      </div>
      {form.campusPolice !== "no" && (
        <div>
          <label className={labelClass}>Officers / security personnel</label>
          <input
            className={inputClass}
            type="number"
            placeholder="25"
            value={form.officerCount}
            onChange={(e) => update("officerCount", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function Step2({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Existing emergency notification system</label>
          <input
            className={inputClass}
            placeholder="Rave / Omnilert / Alertus / None"
            value={form.existingENS}
            onChange={(e) => update("existingENS", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>CAD system</label>
          <Radio
            value={form.cadSystem}
            onChange={(v) => update("cadSystem", v)}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Blue light emergency phones</label>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Radio
              value={form.blueLight}
              onChange={(v) => update("blueLight", v)}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "None" },
              ]}
            />
          </div>
          {form.blueLight === "yes" && (
            <input
              className={`${inputClass} w-24`}
              type="number"
              placeholder="Count"
              value={form.blueLightCount}
              onChange={(e) => update("blueLightCount", e.target.value)}
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Access control systems</label>
          <Radio
            value={form.accessControl}
            onChange={(v) => update("accessControl", v)}
            options={[
              { value: "yes", label: "Full" },
              { value: "partial", label: "Partial" },
              { value: "no", label: "None" },
            ]}
          />
        </div>
        <div>
          <label className={labelClass}>Existing cameras (approx.)</label>
          <input
            className={inputClass}
            type="number"
            placeholder="200"
            value={form.cameraCount}
            onChange={(e) => update("cameraCount", e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Current incident reporting process</label>
        <input
          className={inputClass}
          placeholder="Phone call to dispatch / paper forms / email"
          value={form.reportingProcess}
          onChange={(e) => update("reportingProcess", e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass}>Mutual aid law enforcement agency</label>
        <input
          className={inputClass}
          placeholder="Athens-Clarke County Police Department"
          value={form.mutualAid}
          onChange={(e) => update("mutualAid", e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass}>Identified safety concerns</label>
        <textarea
          className={`${inputClass} min-h-[88px] resize-y`}
          placeholder="Coverage gaps, underreporting, high-traffic areas, late-night incidents, specific buildings of concern…"
          value={form.safetyConcerns}
          onChange={(e) => update("safetyConcerns", e.target.value)}
        />
      </div>
    </div>
  );
}

function Step3({
  form,
  update,
  toggleProgram,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  toggleProgram: (id: GrantProgramId) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Select all programs you plan to apply to — the package will align with each program&apos;s requirements.
      </p>
      <div className="space-y-1.5">
        {GRANT_PROGRAM_IDS.map((id) => {
          const selected = form.grantPrograms.includes(id);
          return (
            <div
              key={id}
              onClick={() => toggleProgram(id)}
              className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-2.5 ${
                selected ? "border-sky-600 bg-sky-950/30" : "border-slate-800 bg-slate-900"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold text-white ${
                  selected ? "border-sky-500 bg-sky-600" : "border-slate-600"
                }`}
              >
                {selected && "✓"}
              </span>
              <span className={`text-sm ${selected ? "text-sky-300" : "text-slate-300"}`}>
                {GRANT_PROGRAM_LABELS[id]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Grant amount requested ($)</label>
          <input
            className={inputClass}
            type="number"
            placeholder="110000"
            value={form.grantAmount}
            onChange={(e) => update("grantAmount", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Project period</label>
          <select
            className={inputClass}
            value={form.projectPeriod}
            onChange={(e) => update("projectPeriod", e.target.value as FormState["projectPeriod"])}
          >
            <option value="12">12 months</option>
            <option value="18">18 months</option>
            <option value="24">24 months</option>
            <option value="36">36 months</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Additional context</label>
        <textarea
          className={`${inputClass} min-h-[88px] resize-y`}
          placeholder="Specific campus features, recent incidents, accreditation requirements, stakeholder priorities…"
          value={form.additionalContext}
          onChange={(e) => update("additionalContext", e.target.value)}
        />
      </div>
    </div>
  );
}

function ReviewStep({ form, error, onGenerate }: { form: FormState; error: Error | null; onGenerate: () => void }) {
  const grantList = form.grantPrograms.map((id) => GRANT_PROGRAM_LABELS[id]);
  const rows: [string, string][] = [
    ["Institution", form.schoolName],
    ["Type", GRANT_SCHOOL_TYPE_LABELS[form.schoolType]],
    ["Location", `${form.city}, ${form.state}`],
    ["Students", form.studentPopulation ? Number.parseInt(form.studentPopulation, 10).toLocaleString() : "—"],
    ["Campuses", form.campusCount],
    ["Grant program(s)", grantList.join(", ") || "None selected"],
    ["Requested amount", form.grantAmount ? `$${Number.parseInt(form.grantAmount, 10).toLocaleString()}` : "—"],
    ["Project period", `${form.projectPeriod} months`],
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-900 px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Package summary</span>
        </div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 border-b border-slate-900 px-4 py-2 last:border-b-0">
            <span className="w-40 shrink-0 text-xs text-slate-500">{k}</span>
            <span className="text-sm font-medium text-slate-200">{v}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          ⚠ {error.message}
        </div>
      )}

      <button
        type="button"
        onClick={onGenerate}
        className="w-full rounded-lg bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500"
      >
        ⚡ Generate grant package for {form.schoolName || "this institution"}
      </button>
      <p className="text-center text-[11px] text-slate-600">Powered by Rapid Cortex AI · Estimated time: 20–40 seconds</p>
    </div>
  );
}

function GrantResult({
  form,
  grantData,
  activeSection,
  setActiveSection,
  onReset,
}: {
  form: FormState;
  grantData: GrantPackage;
  activeSection: SectionId;
  setActiveSection: (s: SectionId) => void;
  onReset: () => void;
}) {
  const totalBudget = grantData.totalBudget || grantData.budget.reduce((s, i) => s + (i.totalCost || 0), 0);

  const paragraphs = (text = "") =>
    text
      .split("\n\n")
      .filter(Boolean)
      .map((p, i) => (
        <p key={i} className="mb-3.5 text-sm leading-relaxed text-slate-200">
          {p}
        </p>
      ));

  const sectionText: Record<SectionId, string> = {
    executive: grantData.executiveSummary,
    problem: grantData.problemStatement,
    narrative: grantData.projectNarrative,
    technology: grantData.technologyDescription,
    justification: grantData.budgetJustification,
    cybersecurity: grantData.cybersecurity,
    sustainability: grantData.sustainability,
    evaluation: grantData.evaluation,
    budget: `TOTAL: $${totalBudget.toLocaleString()}`,
    timeline: grantData.timeline.map((p) => `${p.phase} (${p.period})`).join("\n"),
    outcomes: grantData.outcomes.map((o) => `${o.metric}: ${o.baseline} → ${o.target}`).join("\n"),
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function downloadPdf() {
    setPdfError(null);
    setPdfBusy(true);
    try {
      const res = await fetch("/api/platform/grant-package-pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            schoolName: form.schoolName,
            city: form.city,
            state: form.state,
            grantAmount: form.grantAmount,
            projectPeriod: form.projectPeriod,
          },
          grantPackage: grantData,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error?.trim() || `PDF failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = form.schoolName.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40) || "draft";
      a.href = url;
      a.download = `RC-Grant-Package-${safe}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF download failed");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="flex min-h-[560px] overflow-hidden rounded-lg border border-slate-800">
      <div className="flex w-52 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-3.5 py-3.5">
          <p className="text-sm font-semibold leading-tight text-white">{form.schoolName}</p>
          <p className="text-[11px] text-slate-600">
            {form.city}, {form.state}
          </p>
          {totalBudget > 0 && (
            <p className="mt-1.5 font-mono text-[11px] text-amber-400">${totalBudget.toLocaleString()} requested</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={`block w-full border-l-2 px-3.5 py-2 text-left text-xs ${
                activeSection === sec.id
                  ? "border-sky-500 bg-sky-950/40 font-semibold text-sky-300"
                  : "border-transparent text-slate-400"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-slate-800 p-2.5">
          {pdfError && <p className="px-0.5 text-[10px] leading-snug text-rose-400">{pdfError}</p>}
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void downloadPdf()}
            className="rounded border border-sky-800 bg-sky-950/40 py-2 text-[11px] font-semibold text-sky-300 disabled:opacity-50"
          >
            {pdfBusy ? "Building PDF…" : "⬇ Download PDF"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-slate-700 bg-slate-900/60 py-1.5 text-[11px] font-medium text-slate-400"
          >
            Print
          </button>
          <button type="button" onClick={onReset} className="py-1.5 text-[11px] text-slate-600">
            ← New package
          </button>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <h3 className="mb-4 border-b border-slate-800 pb-3 text-lg font-semibold text-white">
          {NAV_SECTIONS.find((s) => s.id === activeSection)?.label}
        </h3>

        {activeSection === "budget" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-600">
                  <th className="px-2 py-2 font-semibold">Budget item</th>
                  <th className="px-2 py-2 font-semibold">Category</th>
                  <th className="px-2 py-2 text-right font-semibold">Qty</th>
                  <th className="px-2 py-2 text-right font-semibold">Unit cost</th>
                  <th className="px-2 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {grantData.budget.map((line, i) => (
                  <tr key={i} className="border-b border-slate-900">
                    <td className="px-2 py-2.5 font-medium text-slate-200">{line.item}</td>
                    <td className="px-2 py-2.5">
                      <span className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {line.category || "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-slate-400">{line.quantity || 1}</td>
                    <td className="px-2 py-2.5 text-right font-mono text-xs text-slate-400">
                      ${(line.unitCost || 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-semibold text-slate-200">
                      ${(line.totalCost || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-sky-700 bg-sky-950/30">
                  <td colSpan={4} className="px-2 py-3 text-sm font-bold text-sky-300">
                    Total project cost
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-base font-extrabold text-amber-400">
                    ${totalBudget.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeSection === "timeline" && (
          <div className="space-y-5">
            {grantData.timeline.map((phase, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-28 shrink-0 pt-0.5">
                  <div className="rounded border border-sky-800 bg-sky-950/40 px-2 py-1 text-center text-[11px] font-semibold text-sky-300">
                    {phase.period}
                  </div>
                </div>
                <div className="flex-1 border-l border-slate-800 pl-5">
                  <p className="mb-2 text-sm font-semibold text-white">{phase.phase}</p>
                  <ul className="space-y-1">
                    {phase.milestones.map((m, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="mt-0.5 text-sky-400">›</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === "outcomes" && (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-900">
              {["Metric", "Baseline", "Target", "Timeframe"].map((h) => (
                <div key={h} className="px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {h}
                </div>
              ))}
            </div>
            {grantData.outcomes.map((o, i) => (
              <div key={i} className="grid grid-cols-4 border-b border-slate-900 last:border-b-0">
                <div className="px-3.5 py-2.5 text-sm font-semibold text-slate-200">{o.metric}</div>
                <div className="px-3.5 py-2.5 text-sm text-slate-400">{o.baseline}</div>
                <div className="px-3.5 py-2.5 text-sm font-semibold text-emerald-400">{o.target}</div>
                <div className="px-3.5 py-2.5 text-xs text-sky-400">{o.timeframe}</div>
              </div>
            ))}
          </div>
        )}

        {!["budget", "timeline", "outcomes"].includes(activeSection) && paragraphs(sectionText[activeSection])}
      </div>
    </div>
  );
}

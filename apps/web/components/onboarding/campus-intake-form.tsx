"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { CampusIntake } from "rapid-cortex-shared";
import { campusIntakeSchema } from "rapid-cortex-shared";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  CheckboxGroup,
  Field,
  MultiStepShell,
  NumberInput,
  RadioGroup,
  SelectInput,
  Textarea,
  TextInput,
} from "@/components/onboarding/intake-form-primitives";
import { fetchCampusIntake, saveCampusIntake } from "@/lib/onboarding/onboarding-api";

const EMPTY: CampusIntake = {
  orgName: "",
  legalName: "",
  state: "",
  primaryDomain: "",
  studentPopulation: 0,
  securityDepartmentName: "",
  dispatchNumber24x7: "",
  securityDirectorName: "",
  securityDirectorEmail: "",
  titleIxCleryContactName: "",
  titleIxCleryContactEmail: "",
  existingReportingTools: "",
  anonymousReportingPolicy: "allow",
  preferredSmsKeyword: "",
  academicCalendarType: "semester",
  estimatedSignLocations: 0,
  nfcTagsNeeded: "unknown",
  signInstaller: "facilities",
  studentCommsChannel: "email",
  dataRetentionPreference: "3yr",
  notes: "",
};

type Props = {
  orgCode: string;
  agencyId?: string;
};

export function CampusIntakeForm({ orgCode, agencyId }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CampusIntake>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ["campus-intake", orgCode, agencyId ?? ""];

  useQuery({
    queryKey,
    queryFn: async () => {
      const intake = await fetchCampusIntake({ orgCode, agencyId });
      if (intake) {
        const { orgCode: _o, agencyId: _a, submittedAt: _s, submittedBy: _b, updatedAt: _u, ...rest } =
          intake;
        setForm(rest);
      }
      return intake;
    },
  });

  const saveMut = useMutation({
    mutationFn: () => saveCampusIntake({ orgCode, agencyId }, form),
    onSuccess: async () => {
      setSaved(true);
      setError(null);
      await qc.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => setError(err.message),
  });

  const steps = useMemo(
    () => [
      {
        title: "Organization",
        description: "Basic campus identity and domain information.",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organization name">
              <TextInput value={form.orgName} onChange={(v) => setForm({ ...form, orgName: v })} />
            </Field>
            <Field label="Legal name">
              <TextInput value={form.legalName} onChange={(v) => setForm({ ...form, legalName: v })} />
            </Field>
            <Field label="State (2-letter)">
              <TextInput value={form.state} onChange={(v) => setForm({ ...form, state: v.toUpperCase() })} />
            </Field>
            <Field label="Primary domain">
              <TextInput
                value={form.primaryDomain}
                onChange={(v) => setForm({ ...form, primaryDomain: v })}
                placeholder="uga.edu"
              />
            </Field>
            <Field label="Student population">
              <NumberInput
                value={form.studentPopulation}
                onChange={(v) => setForm({ ...form, studentPopulation: v })}
              />
            </Field>
          </div>
        ),
      },
      {
        title: "Security & compliance",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campus security department">
              <TextInput
                value={form.securityDepartmentName}
                onChange={(v) => setForm({ ...form, securityDepartmentName: v })}
              />
            </Field>
            <Field label="24/7 dispatch number">
              <TextInput
                value={form.dispatchNumber24x7}
                onChange={(v) => setForm({ ...form, dispatchNumber24x7: v })}
              />
            </Field>
            <Field label="Security director name">
              <TextInput
                value={form.securityDirectorName}
                onChange={(v) => setForm({ ...form, securityDirectorName: v })}
              />
            </Field>
            <Field label="Security director email">
              <TextInput
                type="email"
                value={form.securityDirectorEmail}
                onChange={(v) => setForm({ ...form, securityDirectorEmail: v })}
              />
            </Field>
            <Field label="Title IX / Clery contact name">
              <TextInput
                value={form.titleIxCleryContactName}
                onChange={(v) => setForm({ ...form, titleIxCleryContactName: v })}
              />
            </Field>
            <Field label="Title IX / Clery contact email">
              <TextInput
                type="email"
                value={form.titleIxCleryContactEmail}
                onChange={(v) => setForm({ ...form, titleIxCleryContactEmail: v })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Existing reporting tools in use">
                <Textarea
                  value={form.existingReportingTools}
                  onChange={(v) => setForm({ ...form, existingReportingTools: v })}
                />
              </Field>
            </div>
          </div>
        ),
      },
      {
        title: "Reporting & SMS",
        content: (
          <div className="grid gap-4">
            <Field label="Anonymous reporting policy">
              <RadioGroup
                value={form.anonymousReportingPolicy}
                onChange={(v) => setForm({ ...form, anonymousReportingPolicy: v })}
                options={[
                  { value: "allow", label: "Allow anonymous reports" },
                  { value: "require", label: "Require identification" },
                  { value: "disallow", label: "Disallow anonymous reports" },
                ]}
              />
            </Field>
            <Field label="Preferred SMS keyword" hint="Short code keyword, e.g. UGA or COLSTATE">
              <TextInput
                value={form.preferredSmsKeyword}
                onChange={(v) => setForm({ ...form, preferredSmsKeyword: v.toUpperCase() })}
              />
            </Field>
            <Field label="Academic calendar type">
              <SelectInput
                value={form.academicCalendarType}
                onChange={(v) => setForm({ ...form, academicCalendarType: v })}
                options={[
                  { value: "semester", label: "Semester" },
                  { value: "quarter", label: "Quarter" },
                  { value: "trimester", label: "Trimester" },
                ]}
              />
            </Field>
          </div>
        ),
      },
      {
        title: "Signage & rollout",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estimated sign locations">
              <NumberInput
                value={form.estimatedSignLocations}
                onChange={(v) => setForm({ ...form, estimatedSignLocations: v })}
              />
            </Field>
            <Field label="NFC tags needed">
              <SelectInput
                value={form.nfcTagsNeeded}
                onChange={(v) => setForm({ ...form, nfcTagsNeeded: v })}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "unknown", label: "Unknown" },
                ]}
              />
            </Field>
            <Field label="Who installs signs">
              <SelectInput
                value={form.signInstaller}
                onChange={(v) => setForm({ ...form, signInstaller: v })}
                options={[
                  { value: "facilities", label: "Facilities" },
                  { value: "vendor", label: "Vendor" },
                  { value: "rc", label: "Rapid Cortex" },
                ]}
              />
            </Field>
            <Field label="Primary student communication channel">
              <SelectInput
                value={form.studentCommsChannel}
                onChange={(v) => setForm({ ...form, studentCommsChannel: v })}
                options={[
                  { value: "email", label: "Email" },
                  { value: "posted_notices", label: "Posted notices" },
                  { value: "student_app", label: "Student app" },
                  { value: "other", label: "Other" },
                ]}
              />
            </Field>
            {form.studentCommsChannel === "other" ? (
              <div className="sm:col-span-2">
                <Field label="Other channel details">
                  <TextInput
                    value={form.studentCommsChannelOther ?? ""}
                    onChange={(v) => setForm({ ...form, studentCommsChannelOther: v })}
                  />
                </Field>
              </div>
            ) : null}
            <Field label="Data retention preference">
              <SelectInput
                value={form.dataRetentionPreference}
                onChange={(v) => setForm({ ...form, dataRetentionPreference: v })}
                options={[
                  { value: "1yr", label: "1 year" },
                  { value: "3yr", label: "3 years" },
                  { value: "7yr", label: "7 years" },
                ]}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea value={form.notes ?? ""} onChange={(v) => setForm({ ...form, notes: v })} rows={4} />
              </Field>
            </div>
          </div>
        ),
      },
    ],
    [form],
  );

  if (saved) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <h2 className="mt-4 text-xl font-semibold text-white">Campus intake saved</h2>
        <p className="mt-2 text-sm text-slate-400">
          Saved to campus config for org code <span className="font-mono text-slate-200">{orgCode}</span>.
        </p>
        <Link
          href={`/onboarding/checklist/campus?orgCode=${encodeURIComponent(orgCode)}`}
          className="mt-6 inline-block text-sm text-violet-400 hover:underline"
        >
          Continue to onboarding checklist →
        </Link>
      </div>
    );
  }

  const current = steps[step];
  const parsed = campusIntakeSchema.safeParse(form);
  const isLast = step === steps.length - 1;

  return (
    <MultiStepShell
      title={current.title}
      description={current.description}
      step={step}
      totalSteps={steps.length}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      onNext={() => {
        if (isLast) {
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Please complete all required fields.");
            return;
          }
          saveMut.mutate();
          return;
        }
        setStep((s) => s + 1);
      }}
      nextLabel={isLast ? "Submit intake" : "Continue"}
      isSubmitting={saveMut.isPending}
    >
      {current.content}
      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
    </MultiStepShell>
  );
}

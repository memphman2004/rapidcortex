"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { VenueIntake } from "rapid-cortex-shared";
import { venueIntakeSchema } from "rapid-cortex-shared";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  Field,
  MultiStepShell,
  NumberInput,
  RadioGroup,
  SelectInput,
  Textarea,
  TextInput,
  CheckboxGroup,
} from "@/components/onboarding/intake-form-primitives";
import { fetchVenueIntake, saveVenueIntake } from "@/lib/onboarding/onboarding-api";

const EMPTY: VenueIntake = {
  venueName: "",
  legalEntityName: "",
  state: "",
  venueCapacity: 0,
  eventFrequency: "year_round",
  securityStaffingModel: "in_house",
  securityDispatchContactName: "",
  securityDispatchContactNumber: "",
  guestServicesContactName: "",
  guestServicesContactEmail: "",
  adaCoordinatorName: "",
  adaCoordinatorEmail: "",
  existingSecurityCommsTools: ["radio"],
  guestServicesReceiveReports: true,
  sectionZoneCount: 0,
  nfcTagsNeeded: "unknown",
  signInstaller: "venue_ops",
  eventCodesAutoExpire: false,
  dataRetentionPreference: "3yr",
  notes: "",
};

type Props = {
  orgCode: string;
  agencyId?: string;
};

export function VenueIntakeForm({ orgCode, agencyId }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<VenueIntake>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ["venue-intake", orgCode, agencyId ?? ""];

  useQuery({
    queryKey,
    queryFn: async () => {
      const intake = await fetchVenueIntake({ orgCode, agencyId });
      if (intake) {
        const { orgCode: _o, agencyId: _a, submittedAt: _s, submittedBy: _b, updatedAt: _u, ...rest } =
          intake;
        setForm(rest);
      }
      return intake;
    },
  });

  const saveMut = useMutation({
    mutationFn: () => saveVenueIntake({ orgCode, agencyId }, form),
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
        title: "Venue profile",
        description: "Basic venue identity and capacity.",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Venue name">
              <TextInput value={form.venueName} onChange={(v) => setForm({ ...form, venueName: v })} />
            </Field>
            <Field label="Legal entity name">
              <TextInput
                value={form.legalEntityName}
                onChange={(v) => setForm({ ...form, legalEntityName: v })}
              />
            </Field>
            <Field label="State (2-letter)">
              <TextInput value={form.state} onChange={(v) => setForm({ ...form, state: v.toUpperCase() })} />
            </Field>
            <Field label="Venue capacity">
              <NumberInput value={form.venueCapacity} onChange={(v) => setForm({ ...form, venueCapacity: v })} />
            </Field>
            <Field label="Event frequency">
              <SelectInput
                value={form.eventFrequency}
                onChange={(v) => setForm({ ...form, eventFrequency: v })}
                options={[
                  { value: "year_round", label: "Year-round" },
                  { value: "seasonal", label: "Seasonal" },
                  { value: "single_event", label: "Single event" },
                ]}
              />
            </Field>
            <Field label="Security staffing model">
              <SelectInput
                value={form.securityStaffingModel}
                onChange={(v) => setForm({ ...form, securityStaffingModel: v })}
                options={[
                  { value: "in_house", label: "In-house" },
                  { value: "contracted", label: "Contracted" },
                  { value: "hybrid", label: "Hybrid" },
                ]}
              />
            </Field>
          </div>
        ),
      },
      {
        title: "Contacts & comms",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Security dispatch contact name">
              <TextInput
                value={form.securityDispatchContactName}
                onChange={(v) => setForm({ ...form, securityDispatchContactName: v })}
              />
            </Field>
            <Field label="Security dispatch number">
              <TextInput
                value={form.securityDispatchContactNumber}
                onChange={(v) => setForm({ ...form, securityDispatchContactNumber: v })}
              />
            </Field>
            <Field label="Guest services contact name">
              <TextInput
                value={form.guestServicesContactName}
                onChange={(v) => setForm({ ...form, guestServicesContactName: v })}
              />
            </Field>
            <Field label="Guest services email">
              <TextInput
                type="email"
                value={form.guestServicesContactEmail}
                onChange={(v) => setForm({ ...form, guestServicesContactEmail: v })}
              />
            </Field>
            <Field label="ADA / accessibility coordinator name">
              <TextInput
                value={form.adaCoordinatorName}
                onChange={(v) => setForm({ ...form, adaCoordinatorName: v })}
              />
            </Field>
            <Field label="ADA / accessibility coordinator email">
              <TextInput
                type="email"
                value={form.adaCoordinatorEmail}
                onChange={(v) => setForm({ ...form, adaCoordinatorEmail: v })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Existing security comms tools">
                <CheckboxGroup
                  values={form.existingSecurityCommsTools}
                  onChange={(v) => setForm({ ...form, existingSecurityCommsTools: v })}
                  options={[
                    { value: "radio", label: "Radio" },
                    { value: "app", label: "App" },
                    { value: "dispatch_software", label: "Dispatch software" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </Field>
            </div>
            {form.existingSecurityCommsTools.includes("other") ? (
              <div className="sm:col-span-2">
                <Field label="Other comms tool">
                  <TextInput
                    value={form.existingSecurityCommsToolsOther ?? ""}
                    onChange={(v) => setForm({ ...form, existingSecurityCommsToolsOther: v })}
                  />
                </Field>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Field label="Do guest services staff also receive incident reports?">
                <RadioGroup
                  value={form.guestServicesReceiveReports ? "yes" : "no"}
                  onChange={(v) => setForm({ ...form, guestServicesReceiveReports: v === "yes" })}
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                />
              </Field>
            </div>
          </div>
        ),
      },
      {
        title: "Zones & signage",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Number of sections / zones">
              <NumberInput
                value={form.sectionZoneCount}
                onChange={(v) => setForm({ ...form, sectionZoneCount: v })}
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
                  { value: "venue_ops", label: "Venue ops" },
                  { value: "vendor", label: "Vendor" },
                  { value: "rc", label: "Rapid Cortex" },
                ]}
              />
            </Field>
            <Field label="Event-specific codes that auto-expire">
              <RadioGroup
                value={form.eventCodesAutoExpire ? "yes" : "no"}
                onChange={(v) => setForm({ ...form, eventCodesAutoExpire: v === "yes" })}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />
            </Field>
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
              <Field label="Media or sponsorship signage restrictions">
                <Textarea
                  value={form.mediaSignageRestrictions ?? ""}
                  onChange={(v) => setForm({ ...form, mediaSignageRestrictions: v })}
                />
              </Field>
            </div>
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
        <h2 className="mt-4 text-xl font-semibold text-white">Venue intake saved</h2>
        <p className="mt-2 text-sm text-slate-400">
          Saved to venue config for org code <span className="font-mono text-slate-200">{orgCode}</span>.
        </p>
        <Link
          href={`/onboarding/checklist/venue?orgCode=${encodeURIComponent(orgCode)}`}
          className="mt-6 inline-block text-sm text-violet-400 hover:underline"
        >
          Continue to onboarding checklist →
        </Link>
      </div>
    );
  }

  const current = steps[step];
  const parsed = venueIntakeSchema.safeParse(form);
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

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import {
  blankCampusIntegrationQuestionnaire,
  campusIntegrationQuestionnaireSchema,
  type CampusIntegrationCampus,
  type CampusIntegrationQuestionnaire,
} from "rapid-cortex-shared";
import {
  Field,
  MultiStepShell,
  NumberInput,
  SelectInput,
  Textarea,
  TextInput,
} from "@/components/onboarding/intake-form-primitives";
import { fetchCampusIntegrations, saveCampusIntegrations } from "@/lib/onboarding/onboarding-api";

function stripRecord(
  record: CampusIntegrationQuestionnaire & Record<string, unknown>,
): CampusIntegrationQuestionnaire {
  const {
    orgCode: _o,
    agencyId: _a,
    submittedAt: _s,
    submittedBy: _b,
    updatedAt: _u,
    pk: _pk,
    sk: _sk,
    ...rest
  } = record;
  return rest as CampusIntegrationQuestionnaire;
}

function emptyCampus(): CampusIntegrationCampus {
  return { code: "", name: "", city: "", state: "", kind: "other", active: true };
}

function CheckAck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded text-violet-500 focus:ring-violet-500"
      />
      <span>{label}</span>
    </label>
  );
}

type Props = { orgCode: string; agencyId?: string };

export function CampusIntegrationForm({ orgCode, agencyId }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CampusIntegrationQuestionnaire>(() =>
    blankCampusIntegrationQuestionnaire(orgCode),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryKey = ["campus-integrations", orgCode, agencyId ?? ""];

  useQuery({
    queryKey,
    queryFn: async () => {
      const record = await fetchCampusIntegrations({ orgCode, agencyId });
      if (record) setForm(stripRecord(record));
      return record;
    },
  });

  const saveMut = useMutation({
    mutationFn: () => saveCampusIntegrations({ orgCode, agencyId }, form),
    onSuccess: async () => {
      setSaved(true);
      setError(null);
      await qc.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateCampus = (index: number, patch: Partial<CampusIntegrationCampus>) => {
    setForm((current) => ({
      ...current,
      campuses: current.campuses.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const steps = useMemo(
    () => [
      {
        title: "Campuses & locations",
        description:
          "List every campus this tenant will operate. Dashboards, buildings, QR locations, and cameras switch across this list.",
        content: (
          <div className="space-y-4">
            {form.campuses.map((campus, index) => (
              <div key={index} className="rounded-lg border border-slate-800 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Campus {index + 1}
                  </p>
                  {form.campuses.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          campuses: current.campuses.filter((_, i) => i !== index),
                        }))
                      }
                      className="text-slate-500 hover:text-rose-300"
                      aria-label="Remove campus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Code">
                    <TextInput
                      value={campus.code}
                      onChange={(v) => updateCampus(index, { code: v.toUpperCase() })}
                      placeholder="BLOOMINGTON"
                    />
                  </Field>
                  <Field label="Name">
                    <TextInput
                      value={campus.name}
                      onChange={(v) => updateCampus(index, { name: v })}
                      placeholder="IU Bloomington"
                    />
                  </Field>
                  <Field label="City">
                    <TextInput
                      value={campus.city ?? ""}
                      onChange={(v) => updateCampus(index, { city: v })}
                    />
                  </Field>
                  <Field label="State">
                    <TextInput
                      value={campus.state ?? ""}
                      onChange={(v) => updateCampus(index, { state: v.toUpperCase() })}
                      placeholder="IN"
                    />
                  </Field>
                  <Field label="Kind">
                    <SelectInput
                      value={campus.kind ?? "other"}
                      onChange={(v) => updateCampus(index, { kind: v })}
                      options={[
                        { value: "main", label: "Main campus" },
                        { value: "regional", label: "Regional" },
                        { value: "medical", label: "Medical" },
                        { value: "research", label: "Research" },
                        { value: "other", label: "Other" },
                      ]}
                    />
                  </Field>
                  <Field label="Est. buildings">
                    <NumberInput
                      value={campus.estimatedBuildings ?? 0}
                      onChange={(v) => updateCampus(index, { estimatedBuildings: v })}
                    />
                  </Field>
                  <Field label="Student headcount">
                    <NumberInput
                      value={campus.studentHeadcount ?? 0}
                      onChange={(v) => updateCampus(index, { studentHeadcount: v })}
                    />
                  </Field>
                  <Field label="Staff headcount">
                    <NumberInput
                      value={campus.staffHeadcount ?? 0}
                      onChange={(v) => updateCampus(index, { staffHeadcount: v })}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({ ...current, campuses: [...current.campuses, emptyCampus()] }))
              }
              className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200"
            >
              <Plus className="h-4 w-4" />
              Add campus
            </button>
          </div>
        ),
      },
      {
        title: "Identity & SSO",
        description: "How staff will sign in. Rapid Cortex uses Cognito Hosted UI with your IdP.",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Identity provider">
              <SelectInput
                value={form.idpVendor}
                onChange={(v) => setForm({ ...form, idpVendor: v })}
                options={[
                  { value: "shibboleth", label: "Shibboleth / InCommon" },
                  { value: "entra", label: "Microsoft Entra ID" },
                  { value: "okta", label: "Okta" },
                  { value: "duo", label: "Duo SSO" },
                  { value: "other", label: "Other" },
                  { value: "unknown", label: "Unknown / TBD" },
                ]}
              />
            </Field>
            <Field label="Protocol">
              <SelectInput
                value={form.ssoProtocol}
                onChange={(v) => setForm({ ...form, ssoProtocol: v })}
                options={[
                  { value: "saml", label: "SAML" },
                  { value: "oidc", label: "OIDC" },
                  { value: "unknown", label: "Unknown" },
                ]}
              />
            </Field>
            {form.idpVendor === "other" ? (
              <Field label="IdP name">
                <TextInput
                  value={form.idpVendorOther ?? ""}
                  onChange={(v) => setForm({ ...form, idpVendorOther: v })}
                />
              </Field>
            ) : null}
            <Field label="Metadata URL">
              <TextInput
                value={form.idpMetadataUrl ?? ""}
                onChange={(v) => setForm({ ...form, idpMetadataUrl: v })}
                placeholder="https://idp.example.edu/metadata"
              />
            </Field>
            <Field label="Entity ID">
              <TextInput value={form.entityId ?? ""} onChange={(v) => setForm({ ...form, entityId: v })} />
            </Field>
            <Field label="Provisioning">
              <SelectInput
                value={form.provisioning}
                onChange={(v) => setForm({ ...form, provisioning: v })}
                options={[
                  { value: "jit", label: "Just-in-time (JIT)" },
                  { value: "scim", label: "SCIM (when available)" },
                  { value: "manual", label: "Manual invites" },
                  { value: "unknown", label: "Unknown" },
                ]}
              />
            </Field>
            <Field label="SIS / HRMS">
              <TextInput
                value={form.sisOrHrms ?? ""}
                onChange={(v) => setForm({ ...form, sisOrHrms: v })}
                placeholder="Workday, Banner, PeopleSoft…"
              />
            </Field>
            <div className="sm:col-span-2">
              <CheckAck
                checked={form.mfaRequired}
                onChange={(v) => setForm({ ...form, mfaRequired: v })}
                label="MFA is required for campus operators"
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="Identity notes">
                <Textarea
                  value={form.identityNotes ?? ""}
                  onChange={(v) => setForm({ ...form, identityNotes: v })}
                />
              </Field>
            </div>
          </div>
        ),
      },
      {
        title: "Video (VMS)",
        description: "Rapid Cortex connects to your VMS of record. We do not replace Milestone, Hanwha, or Genetec.",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary VMS">
              <SelectInput
                value={form.vmsPrimary}
                onChange={(v) => setForm({ ...form, vmsPrimary: v })}
                options={[
                  { value: "milestone", label: "Milestone XProtect" },
                  { value: "hanwha", label: "Hanwha WAVE / Wisenet" },
                  { value: "genetec", label: "Genetec Security Center" },
                  { value: "avigilon", label: "Avigilon / Motorola" },
                  { value: "other", label: "Other" },
                  { value: "none", label: "None yet" },
                  { value: "unknown", label: "Unknown" },
                ]}
              />
            </Field>
            {form.vmsPrimary === "other" ? (
              <Field label="VMS name">
                <TextInput
                  value={form.vmsPrimaryOther ?? ""}
                  onChange={(v) => setForm({ ...form, vmsPrimaryOther: v })}
                />
              </Field>
            ) : null}
            <Field label="Version">
              <TextInput value={form.vmsVersion ?? ""} onChange={(v) => setForm({ ...form, vmsVersion: v })} />
            </Field>
            <Field label="Estimated cameras">
              <NumberInput
                value={form.estimatedCameraCount ?? 0}
                onChange={(v) => setForm({ ...form, estimatedCameraCount: v })}
              />
            </Field>
            <Field label="Privacy-mask owner">
              <TextInput
                value={form.privacyMaskOwner ?? ""}
                onChange={(v) => setForm({ ...form, privacyMaskOwner: v })}
                placeholder="Who maintains masks in the VMS?"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="VMS notes">
                <Textarea value={form.vmsNotes ?? ""} onChange={(v) => setForm({ ...form, vmsNotes: v })} />
              </Field>
            </div>
          </div>
        ),
      },
      {
        title: "Access control, ALPR, CAD",
        description: "Named-system connectors. Rapid Cortex never auto-locks doors or writes back to CAD from this form.",
        content: (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Access control">
                <SelectInput
                  value={form.accessControlVendor}
                  onChange={(v) => setForm({ ...form, accessControlVendor: v })}
                  options={[
                    { value: "cbord", label: "CBORD / CS-Gold" },
                    { value: "lenel", label: "Lenel" },
                    { value: "software_house", label: "Software House" },
                    { value: "other", label: "Other" },
                    { value: "none", label: "None" },
                    { value: "unknown", label: "Unknown" },
                  ]}
                />
              </Field>
              {form.accessControlVendor === "other" ? (
                <Field label="Access-control name">
                  <TextInput
                    value={form.accessControlOther ?? ""}
                    onChange={(v) => setForm({ ...form, accessControlOther: v })}
                  />
                </Field>
              ) : null}
              <Field label="Estimated doors">
                <NumberInput
                  value={form.estimatedDoorCount ?? 0}
                  onChange={(v) => setForm({ ...form, estimatedDoorCount: v })}
                />
              </Field>
              <Field label="ALPR">
                <SelectInput
                  value={form.alprVendor}
                  onChange={(v) => setForm({ ...form, alprVendor: v })}
                  options={[
                    { value: "flock", label: "Flock Safety" },
                    { value: "genetec_autovu", label: "Genetec AutoVu" },
                    { value: "other", label: "Other" },
                    { value: "none", label: "None" },
                    { value: "unknown", label: "Unknown" },
                  ]}
                />
              </Field>
              <Field label="CAD vendor">
                <TextInput
                  value={form.cadVendor ?? ""}
                  onChange={(v) => setForm({ ...form, cadVendor: v })}
                  placeholder="ARMS, CentralSquare…"
                />
              </Field>
              <Field label="RMS vendor">
                <TextInput value={form.rmsVendor ?? ""} onChange={(v) => setForm({ ...form, rmsVendor: v })} />
              </Field>
              <Field label="ALPR camera count">
                <NumberInput
                  value={form.alprCameraCount ?? 0}
                  onChange={(v) => setForm({ ...form, alprCameraCount: v })}
                />
              </Field>
            </div>
            <CheckAck
              checked={form.lockdownOperatorConfirmUnderstood}
              onChange={(v) => setForm({ ...form, lockdownOperatorConfirmUnderstood: v })}
              label="I understand Rapid Cortex never auto-locks doors. Every lockdown requires an operator confirm."
            />
            <CheckAck
              checked={form.cadWritebackDesired}
              onChange={(v) => setForm({ ...form, cadWritebackDesired: v })}
              label="We want CAD write-back discussed later (planning only — this does not turn it on)."
            />
            {form.cadWritebackDesired ? (
              <CheckAck
                checked={form.cadWritebackAddendumAcknowledged}
                onChange={(v) => setForm({ ...form, cadWritebackAddendumAcknowledged: v })}
                label="I acknowledge CAD write-back stays off until a signed addendum. Saving this questionnaire does not enable it."
              />
            ) : null}
            <Field label="Access-control notes">
              <Textarea
                value={form.accessControlNotes ?? ""}
                onChange={(v) => setForm({ ...form, accessControlNotes: v })}
              />
            </Field>
            <Field label="ALPR notes">
              <Textarea value={form.alprNotes ?? ""} onChange={(v) => setForm({ ...form, alprNotes: v })} />
            </Field>
            <Field label="CAD / RMS notes">
              <Textarea value={form.cadNotes ?? ""} onChange={(v) => setForm({ ...form, cadNotes: v })} />
            </Field>
          </div>
        ),
      },
      {
        title: "Other systems",
        description: "Alarms, signage, weather, EOC, ITSM, patrol, and mass notification — connectors after discovery.",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Alarms">
              <TextInput
                value={form.alarmVendor ?? ""}
                onChange={(v) => setForm({ ...form, alarmVendor: v })}
                placeholder="Microkey…"
              />
            </Field>
            <Field label="Digital signage">
              <TextInput
                value={form.digitalSignageVendor ?? ""}
                onChange={(v) => setForm({ ...form, digitalSignageVendor: v })}
                placeholder="FourWinds…"
              />
            </Field>
            <Field label="Weather">
              <TextInput
                value={form.weatherVendor ?? ""}
                onChange={(v) => setForm({ ...form, weatherVendor: v })}
                placeholder="BAMWX…"
              />
            </Field>
            <Field label="EOC platform">
              <TextInput
                value={form.eocPlatform ?? ""}
                onChange={(v) => setForm({ ...form, eocPlatform: v })}
                placeholder="WebEOC…"
              />
            </Field>
            <Field label="ITSM">
              <TextInput
                value={form.itsmVendor ?? ""}
                onChange={(v) => setForm({ ...form, itsmVendor: v })}
                placeholder="ServiceNow…"
              />
            </Field>
            <Field label="Patrol / CAD field">
              <TextInput
                value={form.patrolVendor ?? ""}
                onChange={(v) => setForm({ ...form, patrolVendor: v })}
                placeholder="Heliaus…"
              />
            </Field>
            <Field label="Mass notification">
              <TextInput
                value={form.massNotificationVendor ?? ""}
                onChange={(v) => setForm({ ...form, massNotificationVendor: v })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Other systems notes">
                <Textarea
                  value={form.otherSystemsNotes ?? ""}
                  onChange={(v) => setForm({ ...form, otherSystemsNotes: v })}
                />
              </Field>
            </div>
          </div>
        ),
      },
      {
        title: "EAP, Clery, counseling",
        description: "Clery stays suggestion-only. Rapid Cortex never auto-files or issues Timely Warnings.",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="EAP library owner">
              <TextInput
                value={form.eapLibraryOwnerName ?? ""}
                onChange={(v) => setForm({ ...form, eapLibraryOwnerName: v })}
              />
            </Field>
            <Field label="EAP owner email">
              <TextInput
                value={form.eapLibraryOwnerEmail ?? ""}
                onChange={(v) => setForm({ ...form, eapLibraryOwnerEmail: v })}
                type="email"
              />
            </Field>
            <Field label="Clery coordinator">
              <TextInput
                value={form.cleryCoordinatorName ?? ""}
                onChange={(v) => setForm({ ...form, cleryCoordinatorName: v })}
              />
            </Field>
            <Field label="Clery email">
              <TextInput
                value={form.cleryCoordinatorEmail ?? ""}
                onChange={(v) => setForm({ ...form, cleryCoordinatorEmail: v })}
                type="email"
              />
            </Field>
            <Field label="Counselor routing contact">
              <TextInput
                value={form.counselorRoutingContact ?? ""}
                onChange={(v) => setForm({ ...form, counselorRoutingContact: v })}
              />
            </Field>
            <div className="sm:col-span-2">
              <CheckAck
                checked={form.clerySuggestionOnlyAcknowledged}
                onChange={(v) => setForm({ ...form, clerySuggestionOnlyAcknowledged: v })}
                label="I understand Clery categories are suggestions only. CSA review is required; Rapid Cortex never auto-files or sends Timely Warnings."
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea value={form.eapNotes ?? ""} onChange={(v) => setForm({ ...form, eapNotes: v })} />
              </Field>
            </div>
          </div>
        ),
      },
      {
        title: "Network & go-live",
        description: "Firewall, webhook allowlists, and the people who will run implementation.",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Implementation lead">
              <TextInput
                value={form.implementationLeadName}
                onChange={(v) => setForm({ ...form, implementationLeadName: v })}
              />
            </Field>
            <Field label="Lead email">
              <TextInput
                value={form.implementationLeadEmail}
                onChange={(v) => setForm({ ...form, implementationLeadEmail: v })}
                type="email"
              />
            </Field>
            <Field label="Lead phone">
              <TextInput
                value={form.implementationLeadPhone ?? ""}
                onChange={(v) => setForm({ ...form, implementationLeadPhone: v })}
              />
            </Field>
            <Field label="Target go-live">
              <TextInput
                value={form.targetGoLive ?? ""}
                onChange={(v) => setForm({ ...form, targetGoLive: v })}
                placeholder="2026-11-01"
              />
            </Field>
            <Field label="Firewall contact">
              <TextInput
                value={form.firewallContactName ?? ""}
                onChange={(v) => setForm({ ...form, firewallContactName: v })}
              />
            </Field>
            <Field label="Firewall email">
              <TextInput
                value={form.firewallContactEmail ?? ""}
                onChange={(v) => setForm({ ...form, firewallContactEmail: v })}
                type="email"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Webhook allowlist CIDRs / hostnames" hint="One per line.">
                <Textarea
                  value={form.webhookAllowlistCidrs ?? ""}
                  onChange={(v) => setForm({ ...form, webhookAllowlistCidrs: v })}
                  rows={4}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Change window">
                <Textarea
                  value={form.changeWindowNotes ?? ""}
                  onChange={(v) => setForm({ ...form, changeWindowNotes: v })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Network notes">
                <Textarea
                  value={form.networkNotes ?? ""}
                  onChange={(v) => setForm({ ...form, networkNotes: v })}
                />
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
        <h2 className="mt-4 text-xl font-semibold text-white">Integration questionnaire saved</h2>
        <p className="mt-2 text-sm text-slate-400">
          Campuses are now on this tenant. Every campus dashboard can switch across the list. CAD
          write-back and Clery auto-file were not enabled.
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
  const parsed = campusIntegrationQuestionnaireSchema.safeParse(form);
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
        setError(null);
        setStep((s) => s + 1);
      }}
      nextLabel={isLast ? "Save questionnaire" : "Continue"}
      isSubmitting={saveMut.isPending}
    >
      {current.content}
      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
    </MultiStepShell>
  );
}

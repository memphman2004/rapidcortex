"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { TransitIntake } from "rapid-cortex-shared";
import {
  emptyTransitGuestAssistKnowledge,
  mergeTransitGuestAssistKnowledge,
  transitIntakeSchema,
} from "rapid-cortex-shared";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Field, MultiStepShell, Textarea, TextInput } from "@/components/onboarding/intake-form-primitives";
import { GuestAssistKnowledgeFields } from "@/components/onboarding/guest-assist-knowledge-fields";
import { fetchTransitIntake, saveTransitIntake } from "@/lib/onboarding/onboarding-api";
import { verticalOnboardingContinueHref } from "@/lib/onboarding/continue-href";

const EMPTY: TransitIntake = {
  agencyName: "",
  legalName: "",
  state: "",
  operationsContactName: "",
  operationsContactNumber: "",
  riderServicesContactName: "",
  riderServicesContactEmail: "",
  guestAssistKnowledge: emptyTransitGuestAssistKnowledge(),
  notes: "",
};

type Props = {
  orgCode: string;
  agencyId: string;
};

export function TransitIntakeForm({ orgCode, agencyId }: Props) {
  const pathname = usePathname();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<TransitIntake>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ["transit-intake", orgCode, agencyId];

  useQuery({
    queryKey,
    queryFn: async () => {
      const intake = await fetchTransitIntake({ orgCode, agencyId });
      if (intake) {
        const { orgCode: _o, agencyId: _a, submittedAt: _s, submittedBy: _b, updatedAt: _u, ...rest } =
          intake;
        setForm({
          ...EMPTY,
          ...rest,
          guestAssistKnowledge: mergeTransitGuestAssistKnowledge(rest.guestAssistKnowledge),
        });
      }
      return intake;
    },
  });

  const saveMut = useMutation({
    mutationFn: () => saveTransitIntake({ orgCode, agencyId }, form),
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
        title: "Transit profile",
        description: "Agency identity and the operations desk Guest Assist should escalate to.",
        content: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Agency name">
              <TextInput
                value={form.agencyName}
                onChange={(v) => setForm({ ...form, agencyName: v })}
              />
            </Field>
            <Field label="Legal name">
              <TextInput value={form.legalName} onChange={(v) => setForm({ ...form, legalName: v })} />
            </Field>
            <Field label="State (2-letter)">
              <TextInput
                value={form.state}
                onChange={(v) => setForm({ ...form, state: v.toUpperCase() })}
              />
            </Field>
            <Field label="Operations contact name">
              <TextInput
                value={form.operationsContactName}
                onChange={(v) => setForm({ ...form, operationsContactName: v })}
              />
            </Field>
            <Field label="Operations contact number">
              <TextInput
                value={form.operationsContactNumber}
                onChange={(v) => setForm({ ...form, operationsContactNumber: v })}
              />
            </Field>
            <Field label="Rider services contact name">
              <TextInput
                value={form.riderServicesContactName ?? ""}
                onChange={(v) => setForm({ ...form, riderServicesContactName: v })}
              />
            </Field>
            <Field label="Rider services email">
              <TextInput
                value={form.riderServicesContactEmail ?? ""}
                onChange={(v) => setForm({ ...form, riderServicesContactEmail: v })}
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
      {
        title: "Guest Assist knowledge",
        description:
          "Facts Claude uses for this system’s scan-page categories (Trip Planning, Schedules, Fares, and the rest).",
        content: (
          <GuestAssistKnowledgeFields
            vertical="transit"
            value={form.guestAssistKnowledge}
            onChange={(guestAssistKnowledge) =>
              setForm({
                ...form,
                guestAssistKnowledge: mergeTransitGuestAssistKnowledge(guestAssistKnowledge),
              })
            }
          />
        ),
      },
    ],
    [form],
  );

  if (saved) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <h2 className="mt-4 text-xl font-semibold text-white">Transit intake saved</h2>
        <p className="mt-2 text-sm text-slate-400">
          Saved to transit config for org code <span className="font-mono text-slate-200">{orgCode}</span>.
        </p>
        <Link
          href={verticalOnboardingContinueHref(pathname, "/onboarding/packets")}
          className="mt-6 inline-block text-sm text-violet-400 hover:underline"
        >
          Continue to onboarding packets →
        </Link>
      </div>
    );
  }

  const current = steps[step];
  const parsed = transitIntakeSchema.safeParse(form);
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

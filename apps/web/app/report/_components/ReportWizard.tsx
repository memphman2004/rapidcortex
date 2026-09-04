"use client";

import { useMemo, useState } from "react";
import { StepAddDetails } from "./StepAddDetails";
import { StepConfirmLocation } from "./StepConfirmLocation";
import { StepConfirmed } from "./StepConfirmed";
import { StepSelectType } from "./StepSelectType";
import type { ReportFormState } from "../_lib/report-types";

export function ReportWizard({
  initialVenueCode,
  initialZoneCode,
  initialZoneLabel,
}: {
  initialVenueCode: string;
  initialZoneCode: string;
  initialZoneLabel: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [state, setState] = useState<ReportFormState>({
    step: 1,
    helpType: null,
    venueCode: initialVenueCode.toUpperCase(),
    zoneCode: initialZoneCode.toUpperCase(),
    zoneLabel: initialZoneLabel,
    details: "",
    phoneNumber: "",
    photoFile: null,
    photoPreviewUrl: null,
    submitted: false,
    referenceId: null,
  });

  const selectedHelpType = useMemo(() => state.helpType, [state.helpType]);

  const handleSubmit = async () => {
    if (!state.helpType) return;
    setIsSubmitting(true);
    setSubmitError(
      "This reporting link is not a QR location code. Scan the posted QR code, or call 911 for emergencies.",
    );
    setIsSubmitting(false);
  };

  if (state.step === 1) {
    return (
      <StepSelectType
        venueCode={state.venueCode}
        onSelect={(type) => setState((current) => ({ ...current, helpType: type, step: 2 }))}
      />
    );
  }

  if (state.step === 2 && selectedHelpType) {
    return (
      <StepConfirmLocation
        venueCode={state.venueCode}
        zoneCode={state.zoneCode}
        zoneLabel={state.zoneLabel}
        helpType={selectedHelpType}
        onBack={() => setState((current) => ({ ...current, step: 1 }))}
        onConfirm={(zoneLabelValue) =>
          setState((current) => ({
            ...current,
            zoneLabel: zoneLabelValue,
            step: 3,
          }))
        }
      />
    );
  }

  if (state.step === 3) {
    return (
      <div>
        <StepAddDetails
          details={state.details}
          phoneNumber={state.phoneNumber}
          photoPreviewUrl={state.photoPreviewUrl}
          onDetailsChange={(value) => setState((current) => ({ ...current, details: value }))}
          onPhoneChange={(value) => setState((current) => ({ ...current, phoneNumber: value }))}
          onPhotoChange={(file, previewUrl) =>
            setState((current) => ({ ...current, photoFile: file, photoPreviewUrl: previewUrl }))
          }
          onPhotoClear={() => setState((current) => ({ ...current, photoFile: null, photoPreviewUrl: null }))}
          onBack={() => setState((current) => ({ ...current, step: 2 }))}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
        {submitError ? (
          <p className="mx-auto max-w-md px-4 pb-8 text-center text-sm text-red-600">{submitError}</p>
        ) : null}
      </div>
    );
  }

  if (state.referenceId && state.helpType) {
    return (
      <StepConfirmed
        referenceId={state.referenceId}
        helpType={state.helpType}
        zoneLabel={state.zoneLabel}
        venueCode={state.venueCode}
      />
    );
  }

  return null;
}

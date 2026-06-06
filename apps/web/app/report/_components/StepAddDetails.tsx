"use client";

import { useRef } from "react";
import { Camera, ChevronLeft, X } from "lucide-react";
import { ReportProgress } from "./ReportProgress";

export function StepAddDetails({
  details,
  phoneNumber,
  photoPreviewUrl,
  onDetailsChange,
  onPhoneChange,
  onPhotoChange,
  onPhotoClear,
  onSubmit,
  onBack,
  isSubmitting,
}: {
  details: string;
  phoneNumber: string;
  photoPreviewUrl: string | null;
  onDetailsChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPhotoChange: (file: File, previewUrl: string) => void;
  onPhotoClear: () => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="flex min-h-[70vh] flex-col justify-between">
      <div>
        <ReportProgress step={3} total={4} />
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-12 items-center gap-1 text-sm text-slate-500"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-2xl font-semibold text-slate-800">Add details</h1>
        <p className="mt-2 text-sm text-slate-500">
          Everything below is optional. Your report will be sent either way.
        </p>

        <div className="mt-4">
          <label htmlFor="details" className="mb-2 block text-sm font-medium text-slate-700">
            Describe what&apos;s happening
          </label>
          <textarea
            id="details"
            rows={3}
            value={details}
            maxLength={500}
            onChange={(event) => onDetailsChange(event.target.value)}
            placeholder="Describe what you're seeing..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-700 outline-none focus:border-blue-400"
          />
          <p className="mt-1 text-right text-xs text-slate-400">{details.length}/500</p>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Add a photo</p>
          {!photoPreviewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-base text-slate-500"
            >
              <Camera className="h-5 w-5" />
              Add a photo (optional)
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreviewUrl} alt="Selected upload preview" className="max-h-32 w-full object-cover" />
              <button
                type="button"
                onClick={onPhotoClear}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0];
              if (!selectedFile) return;
              const previewUrl = URL.createObjectURL(selectedFile);
              onPhotoChange(selectedFile, previewUrl);
            }}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="phoneNumber" className="mb-1 block text-sm font-medium text-slate-700">
            Your phone number (optional)
          </label>
          <p className="mb-2 text-xs text-slate-400">Only used if security needs to follow up with you.</p>
          <input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="+1 (555) 000-0000"
            className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-base text-slate-700 outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex min-h-16 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-5 text-xl font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "Sending..." : "Send to Security →"}
        </button>
        <p className="mt-3 text-center text-xs text-slate-400">
          For life-threatening emergencies, call 911 immediately.
        </p>
      </div>
    </section>
  );
}

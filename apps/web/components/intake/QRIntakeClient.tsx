"use client";

import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { useCallback, useState } from "react";
import type { QRLocationPublic } from "rapid-cortex-shared";

type HelpType = "safety" | "medical" | "suspicious" | "other";

const HELP_OPTIONS: { type: HelpType; label: string; emoji: string; description: string }[] = [
  { type: "medical", label: "Medical", emoji: "🏥", description: "Someone needs medical attention" },
  { type: "safety", label: "Safety concern", emoji: "🛡️", description: "Safety or security issue" },
  { type: "suspicious", label: "Suspicious activity", emoji: "👁️", description: "Something seems wrong" },
  { type: "other", label: "Other", emoji: "💬", description: "Something else" },
];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadQrIntakeMedia(rcli: string, file: File): Promise<string | null> {
  const isVideo = file.type.startsWith("video/");
  const mediaType = isVideo ? "video" : "image";
  const presignRes = await fetch(
    `/api/r/${encodeURIComponent(rcli)}/media-upload-url?type=${mediaType}`,
  );
  if (!presignRes.ok) return null;
  const presign = (await presignRes.json()) as {
    uploadUrl?: string;
    key?: string;
    contentType?: string;
  };
  if (!presign.uploadUrl || !presign.key) return null;

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": presign.contentType ?? (isVideo ? "video/mp4" : "image/jpeg") },
    body: file,
  });
  if (!putRes.ok) return null;
  return presign.key;
}

export function QRIntakeClient({
  rcli,
  location,
}: {
  rcli: string;
  location: QRLocationPublic;
}) {
  const [step, setStep] = useState<"type" | "details" | "done">("type");
  const [helpType, setHelpType] = useState<HelpType | null>(null);
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const handlePhoto = async (file: File | null) => {
    if (!file) {
      setPhotoPreview(null);
      setPhotoFile(null);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setPhotoPreview(dataUrl);
    setPhotoFile(file);
  };

  const handleSubmit = async () => {
    if (!helpType) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (shareLiveLocation && !coords) requestLocation();

      const mediaKeys: string[] = [];
      if (photoFile) {
        const key = await uploadQrIntakeMedia(rcli, photoFile);
        if (key) mediaKeys.push(key);
      }

      const res = await fetch(`/api/r/${encodeURIComponent(rcli)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          helpType,
          description: description.trim(),
          mediaKeys,
          shareLiveLocation,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          isAnonymous,
          reporterName: isAnonymous ? null : reporterName.trim() || null,
          reporterPhone: isAnonymous ? null : reporterPhone.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        referenceId?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? body.message ?? "Unable to submit report. Please try again.");
        return;
      }
      setReferenceId(body.referenceId ?? null);
      setStep("done");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center py-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-800">Help is on the way</h1>
        <p className="mt-2 text-slate-500">Your report has been received.</p>
        {referenceId ? (
          <div className="mt-6 w-full rounded-xl bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-400">Reference number</p>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-700">{referenceId}</p>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="flex min-h-[70vh] flex-col">
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-2 text-sm text-blue-900">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">You are at {location.locationName}</p>
            <p className="mt-1 text-blue-800">Zone {location.zoneCode}</p>
            {location.building ? <p className="mt-1 text-blue-700">{location.building}</p> : null}
          </div>
        </div>
      </div>

      {step === "type" ? (
        <>
          <h1 className="text-2xl font-semibold text-slate-800">What do you need?</h1>
          <p className="mb-4 mt-2 text-sm text-slate-500">Tap to let us know how we can help.</p>
          <div className="grid grid-cols-2 gap-3">
            {HELP_OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => {
                  setHelpType(option.type);
                  setStep("details");
                }}
                className="min-h-24 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50"
              >
                <p className="mb-1 text-3xl">{option.emoji}</p>
                <p className="text-base font-semibold text-slate-800">{option.label}</p>
                <p className="mt-1 text-xs text-slate-400">{option.description}</p>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === "details" && helpType ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("type")}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Change report type
          </button>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Describe what happened…"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full text-sm"
              onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)}
            />
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Preview" className="mt-2 max-h-40 rounded-lg border" />
            ) : null}
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={shareLiveLocation}
              onChange={(e) => {
                setShareLiveLocation(e.target.checked);
                if (e.target.checked) requestLocation();
              }}
            />
            Share my current location
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            Submit anonymously
          </label>

          {!isAnonymous ? (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="tel"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit report
          </button>
        </div>
      ) : null}
    </section>
  );
}

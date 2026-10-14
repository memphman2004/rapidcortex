"use client";

import { useState } from "react";
import {
  ESCORT_IQ_PRODUCT_NAME,
  ESCORT_IQ_SUPPORTING,
  ESCORT_IQ_TAGLINE,
  type EscortMethod,
} from "rapid-cortex-shared";
import { CampusLiveLocationShare } from "@/components/qr-nfc/campus-live-location-share";
import { SAFETY_BRAND } from "@/components/qr-nfc/safety-reporting/tokens";
import { SafetyHeader } from "@/components/qr-nfc/safety-reporting/SafetyHeader";

type Props = {
  qrId: string;
  medium: "qr" | "nfc" | "direct" | "url";
  callNumber?: string;
  locationLabel: string;
  onBack: () => void;
};

const METHOD_OPTIONS: { id: EscortMethod; label: string; hint: string }[] = [
  { id: "GPS", label: "Live GPS Escort", hint: "Share your location while you travel" },
  { id: "PHYSICAL", label: "In-Person Escort", hint: "Request campus police or security" },
  { id: "VOICE", label: "Live Voice Escort", hint: "Call campus safety (one-tap)" },
  { id: "VIDEO", label: "Live Video Escort", hint: "Optional — when campus enables video" },
];

export function EscortIqLanding({ qrId, medium, callNumber, locationLabel, onBack }: Props) {
  const [methods, setMethods] = useState<EscortMethod[]>(["GPS"]);
  const [destination, setDestination] = useState("");
  const [phone, setPhone] = useState("");
  const [gpsConsent, setGpsConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    referenceCode: string;
    publicToken: string;
    trackingToken?: string;
  } | null>(null);

  function toggleMethod(id: EscortMethod) {
    setMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!destination.trim()) {
      setError("Enter a destination.");
      return;
    }
    if (methods.length === 0) {
      setError("Select at least one assistance method.");
      return;
    }
    if (methods.includes("GPS") && !gpsConsent) {
      setError("Consent is required for Live GPS Escort.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/escort-iq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrId,
          medium,
          methods,
          destination: { description: destination.trim() },
          startingLocationNote: locationLabel,
          callbackPhoneE164: phone.trim() || undefined,
          gpsConsent: methods.includes("GPS") ? gpsConsent : undefined,
        }),
      });
      const body = (await res.json()) as {
        referenceCode?: string;
        publicToken?: string;
        trackingToken?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? body.message ?? "Could not start escort request.");
      }
      if (!body.referenceCode || !body.publicToken) {
        throw new Error("Invalid escort response.");
      }
      setDone({
        referenceCode: body.referenceCode,
        publicToken: body.publicToken,
        trackingToken: body.trackingToken,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start escort request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[100dvh] flex-col" style={{ background: SAFETY_BRAND.lightBg }}>
        <SafetyHeader productLabel={ESCORT_IQ_PRODUCT_NAME} />
        <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
          <h1 className="text-xl font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            Escort request received
          </h1>
          <p className="text-sm" style={{ color: SAFETY_BRAND.muted }}>
            Reference <span className="font-mono font-semibold">{done.referenceCode}</span>
          </p>
          <p className="text-sm" style={{ color: SAFETY_BRAND.textDark }}>
            Campus safety can see your request. Keep this screen open if you shared location.
          </p>
          {done.trackingToken ? <CampusLiveLocationShare token={done.trackingToken} /> : null}
          {callNumber ? (
            <a
              href={`tel:${callNumber}`}
              className="block rounded-xl px-4 py-3 text-center text-sm font-semibold text-white"
              style={{ backgroundColor: SAFETY_BRAND.deepBlue }}
            >
              Contact Campus Safety
            </a>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: SAFETY_BRAND.lightBg }}>
      <SafetyHeader productLabel={ESCORT_IQ_PRODUCT_NAME} />
      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pb-10 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 text-sm font-semibold"
          style={{ color: SAFETY_BRAND.deepBlue }}
        >
          ← Back
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: SAFETY_BRAND.muted }}>
            From NexCort iQ
          </p>
          <h1 className="mt-1 text-2xl font-bold" style={{ color: SAFETY_BRAND.textDark }}>
            Escort iQ
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: SAFETY_BRAND.deepBlue }}>
            {ESCORT_IQ_SUPPORTING}
          </p>
          <p className="mt-1 text-xs" style={{ color: SAFETY_BRAND.muted }}>
            {ESCORT_IQ_TAGLINE}
          </p>
          <p className="mt-3 text-sm" style={{ color: SAFETY_BRAND.textDark }}>
            Starting from <span className="font-semibold">{locationLabel}</span> (registered scan
            point — not live GPS until you consent).
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
              Assistance methods
            </legend>
            {METHOD_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-start gap-3 rounded-xl border px-3 py-3"
                style={{ borderColor: SAFETY_BRAND.border, background: "#fff" }}
              >
                <input
                  type="checkbox"
                  checked={methods.includes(opt.id)}
                  onChange={() => toggleMethod(opt.id)}
                  className="mt-1 h-5 w-5"
                  style={{ accentColor: SAFETY_BRAND.deepBlue }}
                />
                <span>
                  <span className="block text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
                    {opt.label}
                  </span>
                  <span className="block text-xs" style={{ color: SAFETY_BRAND.muted }}>
                    {opt.hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
            Destination
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              placeholder="Building, residence hall, parking lot…"
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: SAFETY_BRAND.border }}
            />
          </label>

          <label className="block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
            Callback phone (optional unless GPS)
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: SAFETY_BRAND.border }}
              autoComplete="tel"
            />
          </label>

          {methods.includes("GPS") ? (
            <label className="flex items-start gap-3 rounded-xl border px-3 py-3">
              <input
                type="checkbox"
                checked={gpsConsent}
                onChange={(e) => setGpsConsent(e.target.checked)}
                className="mt-1 h-5 w-5"
                style={{ accentColor: SAFETY_BRAND.deepBlue }}
              />
              <span className="text-sm" style={{ color: SAFETY_BRAND.textDark }}>
                <span className="font-semibold">I consent to share my live location</span> with campus
                safety until I arrive or stop sharing. Keep this screen on — browsers may pause GPS when
                locked or backgrounded.
              </span>
            </label>
          ) : null}

          {error ? (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: SAFETY_BRAND.deepBlue }}
          >
            {submitting ? "Requesting…" : "Request an Escort"}
          </button>
        </form>

        <div className="grid gap-2 pt-2">
          {callNumber ? (
            <a
              href={`tel:${callNumber}`}
              className="rounded-xl border px-4 py-3 text-center text-sm font-semibold"
              style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.deepBlue }}
            >
              Contact Campus Safety
            </a>
          ) : null}
          <a
            href="tel:911"
            className="rounded-xl px-4 py-3 text-center text-sm font-semibold text-white"
            style={{ backgroundColor: SAFETY_BRAND.rapidRed }}
          >
            Emergency Assistance — Call 911
          </a>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { SAFETY_BRAND } from "./safety-reporting/tokens";

type Medium = "qr" | "nfc" | "direct" | "url";
type Step =
  | "phone"
  | "otp"
  | "renew"
  | "path"
  | "change"
  | "success";

type ConfirmNext = {
  next: "renew" | "register";
  challengeId: string;
  universityName: string;
  maskedPhone: string;
  subscription?: {
    status: string;
    maskedPhone: string;
    renewalDueAt?: string;
    subscriptionExpiresAt?: string;
    alreadyRegistered: boolean;
  };
};

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export function CampusAlertsRegistration({
  qrId,
  medium,
  universityNameHint,
  onBack,
}: {
  qrId: string;
  medium: Medium;
  universityNameHint?: string;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [universityName, setUniversityName] = useState(universityNameHint ?? "");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [subscription, setSubscription] = useState<ConfirmNext["subscription"]>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prevPhone, setPrevPhone] = useState("");
  const [prevAccessible, setPrevAccessible] = useState<boolean | null>(null);

  async function startVerify() {
    setBusy(true);
    setError(null);
    const r = await postJson<{
      challengeId: string;
      universityName: string;
      maskedPhone: string;
    }>("/api/public/campus-alerts/verify/start", {
      qrId,
      phone,
      smsConsent: true,
      medium,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? "We couldn't verify this number. Please try again or contact campus support.");
      return;
    }
    setChallengeId(r.data.challengeId);
    setUniversityName(r.data.universityName);
    setMaskedPhone(r.data.maskedPhone);
    setStep("otp");
  }

  async function confirmOtp() {
    setBusy(true);
    setError(null);
    const r = await postJson<ConfirmNext>("/api/public/campus-alerts/verify/confirm", {
      challengeId,
      code,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? "We couldn't verify this number. Please try again or contact campus support.");
      return;
    }
    setChallengeId(r.data.challengeId);
    setUniversityName(r.data.universityName);
    setMaskedPhone(r.data.maskedPhone);
    setSubscription(r.data.subscription);
    setStep(r.data.next === "renew" ? "renew" : "path");
  }

  async function doRenew() {
    setBusy(true);
    setError(null);
    const r = await postJson<{ message: string }>("/api/public/campus-alerts/renew", {
      challengeId,
      renew: true,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? "Renewal failed. Please try again.");
      return;
    }
    setMessage(r.data.message);
    setStep("success");
  }

  async function doRegister(path: "first_registration" | "changed_number") {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { challengeId, path };
    if (path === "changed_number") {
      body.previousPhoneAccessible = prevAccessible === true;
      if (prevAccessible === true) {
        body.previousPhone = prevPhone;
        // Old-number OTP must already be completed via a separate start/confirm in a full flow.
        // This slice records the intent; staff-assisted unlink covers inaccessible numbers.
      }
    }
    const r = await postJson<{ message: string }>("/api/public/campus-alerts/register", body);
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? "Registration failed. Please try again.");
      return;
    }
    setMessage(r.data.message);
    setStep("success");
  }

  const cardStyle = {
    borderColor: SAFETY_BRAND.border,
    boxShadow: SAFETY_BRAND.cardShadow,
  } as const;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 text-sm font-semibold"
        style={{ color: SAFETY_BRAND.deepBlue }}
      >
        ← Back to Information
      </button>

      <div className="rounded-2xl border bg-white p-5" style={cardStyle}>
        <h2 className="text-lg font-bold tracking-tight" style={{ color: SAFETY_BRAND.deepBlue }}>
          Campus Alerts Registration
        </h2>
        <p className="mt-1 text-sm" style={{ color: SAFETY_BRAND.muted }}>
          Register or renew your phone number to receive campus safety notifications.
        </p>
        {universityName ? (
          <p className="mt-2 text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
            {universityName}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {step === "phone" ? (
        <div className="space-y-3 rounded-2xl border bg-white p-5" style={cardStyle}>
          <label className="block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
            Mobile phone number
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full min-h-12 rounded-xl border px-3 text-base"
              style={{ borderColor: SAFETY_BRAND.border }}
              placeholder="(555) 555-5555"
            />
          </label>
          <p className="text-xs leading-relaxed" style={{ color: SAFETY_BRAND.muted }}>
            Message and data rates may apply. Reply STOP to opt out, HELP for help. Campus Alerts
            are optional and are not a substitute for calling 911.
          </p>
          <label className="flex items-start gap-2 text-sm" style={{ color: SAFETY_BRAND.textDark }}>
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              I agree to receive optional Campus Alerts SMS notifications from this university.
            </span>
          </label>
          <button
            type="button"
            disabled={!smsConsent || phone.trim().length < 7 || busy}
            onClick={() => void startVerify()}
            className="min-h-12 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: SAFETY_BRAND.deepBlue }}
          >
            {busy ? "Sending…" : "Verify My Number"}
          </button>
        </div>
      ) : null}

      {step === "otp" ? (
        <div className="space-y-3 rounded-2xl border bg-white p-5" style={cardStyle}>
          <p className="text-sm" style={{ color: SAFETY_BRAND.muted }}>
            Enter the 6-digit code sent to {maskedPhone || "your phone"}.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full min-h-12 rounded-xl border px-3 text-center text-xl tracking-widest"
            style={{ borderColor: SAFETY_BRAND.border }}
          />
          <button
            type="button"
            disabled={code.length !== 6 || busy}
            onClick={() => void confirmOtp()}
            className="min-h-12 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: SAFETY_BRAND.deepBlue }}
          >
            {busy ? "Checking…" : "Confirm code"}
          </button>
        </div>
      ) : null}

      {step === "renew" ? (
        <div className="space-y-3 rounded-2xl border bg-white p-5" style={cardStyle}>
          <h3 className="text-base font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            You&apos;re Already Registered!
          </h3>
          <p className="text-sm" style={{ color: SAFETY_BRAND.muted }}>
            Thank you for keeping your campus safety information current.
          </p>
          <ul className="text-sm" style={{ color: SAFETY_BRAND.textDark }}>
            <li>Number: {subscription?.maskedPhone ?? maskedPhone}</li>
            <li>Status: {subscription?.status ?? "SUBSCRIBED"}</li>
            {subscription?.renewalDueAt || subscription?.subscriptionExpiresAt ? (
              <li>
                Next renewal:{" "}
                {new Date(
                  subscription.renewalDueAt ?? subscription.subscriptionExpiresAt!,
                ).toLocaleDateString()}
              </li>
            ) : null}
          </ul>
          <p className="text-sm" style={{ color: SAFETY_BRAND.muted }}>
            You&apos;re already registered. Verify and renew to keep your information current.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void doRenew()}
            className="min-h-12 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: SAFETY_BRAND.deepBlue }}
          >
            {busy ? "Renewing…" : "Renew My Registration"}
          </button>
        </div>
      ) : null}

      {step === "path" ? (
        <div className="space-y-3 rounded-2xl border bg-white p-5" style={cardStyle}>
          <h3 className="text-base font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            Welcome to Campus Alerts
          </h3>
          <p className="text-sm" style={{ color: SAFETY_BRAND.muted }}>
            Are you registering for the first time, or have you changed your phone number?
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void doRegister("first_registration")}
            className="min-h-12 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: SAFETY_BRAND.deepBlue }}
          >
            This Is My First Registration
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("change")}
            className="min-h-12 w-full rounded-xl border text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.deepBlue }}
          >
            I Changed My Phone Number
          </button>
        </div>
      ) : null}

      {step === "change" ? (
        <div className="space-y-3 rounded-2xl border bg-white p-5" style={cardStyle}>
          <p className="text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
            What was your previous phone number?
          </p>
          <input
            type="tel"
            value={prevPhone}
            onChange={(e) => setPrevPhone(e.target.value)}
            className="w-full min-h-12 rounded-xl border px-3"
            style={{ borderColor: SAFETY_BRAND.border }}
            placeholder="Previous number (optional if no longer accessible)"
          />
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium" style={{ color: SAFETY_BRAND.textDark }}>
              Can you still receive messages at your old number?
            </legend>
            <label className="flex gap-2">
              <input
                type="radio"
                name="prevAccess"
                checked={prevAccessible === true}
                onChange={() => setPrevAccessible(true)}
              />
              I can still receive messages at my old number
            </label>
            <label className="flex gap-2">
              <input
                type="radio"
                name="prevAccess"
                checked={prevAccessible === false}
                onChange={() => setPrevAccessible(false)}
              />
              I no longer have access to my old number
            </label>
          </fieldset>
          {prevAccessible === true ? (
            <p className="text-xs" style={{ color: SAFETY_BRAND.muted }}>
              For security, transferring a subscription requires verifying the old number in a
              separate step. Contact campus safety if you need staff-assisted unlinking.
            </p>
          ) : null}
          {prevAccessible === false ? (
            <p className="text-xs" style={{ color: SAFETY_BRAND.muted }}>
              Your new number can register independently. We will not deactivate another person&apos;s
              registration based on an unverified previous number.
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || prevAccessible === null}
            onClick={() => void doRegister("changed_number")}
            className="min-h-12 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: SAFETY_BRAND.deepBlue }}
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      ) : null}

      {step === "success" ? (
        <div className="rounded-2xl border bg-white p-5" style={cardStyle} role="status">
          <h3 className="text-base font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            Thank you for registering for Campus Alerts.
          </h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: SAFETY_BRAND.muted }}>
            {message}
          </p>
        </div>
      ) : null}
    </div>
  );
}

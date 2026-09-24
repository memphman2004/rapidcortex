"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WYZE_TM } from "@/lib/brand-marks";
import { connectPublicApiBase } from "@/lib/connect-public-api";

type Step = "intro" | "form" | "success";

type FormData = {
  agencyId: string;
  email: string;
  phone: string;
  keyId: string;
  apiKey: string;
  address: string;
  lat: string;
  lng: string;
};

const WYZE_DEV_PORTAL = "https://developer-api-console.wyze.com/#/apikey/view";
const API_BASE = connectPublicApiBase();

export function WyzeConnectFlow() {
  const searchParams = useSearchParams();
  const prefillAgency = searchParams.get("agencyId")?.trim() ?? "";
  const [step, setStep] = useState<Step>("intro");
  const [form, setForm] = useState<FormData>({
    agencyId: prefillAgency,
    email: "",
    phone: "",
    keyId: "",
    apiKey: "",
    address: "",
    lat: "",
    lng: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState(0);

  const registerUrl = useMemo(() => {
    const base = API_BASE.replace(/\/$/, "");
    return `${base}/api/cameras/providers/wyze/register`;
  }, []);

  function updateField(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
      }));
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!API_BASE) {
      setError("Enrollment API is not configured for this site. Try again later or contact your agency.");
      setLoading(false);
      return;
    }
    try {
      const phone = form.phone.trim().startsWith("+")
        ? form.phone.trim()
        : `+1${form.phone.replace(/\D/g, "")}`;
      const res = await fetch(registerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId: form.agencyId.trim(),
          email: form.email.trim(),
          phone,
          keyId: form.keyId.trim(),
          apiKey: form.apiKey.trim(),
          address: form.address.trim(),
          lat: Number.parseFloat(form.lat),
          lng: Number.parseFloat(form.lng),
        }),
      });
      const json = (await res.json()) as { error?: string; camerasFound?: number };
      if (!res.ok) {
        setError(json.error ?? "Registration failed. Please try again.");
        return;
      }
      setCameras(json.camerasFound ?? 0);
      setStep("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "intro") {
    return (
      <div className="space-y-6 text-sm leading-relaxed text-slate-300">
        <p>
          Register your {WYZE_TM} camera with your local emergency communications center. You stay in
          control — you decide whether to share, and sharing stops automatically.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Generate a free API key at the {WYZE_TM} Developer Portal (about 2 minutes).</li>
          <li>Enter your contact details, API credentials, and camera address.</li>
          <li>When responders need the feed, you get an SMS — tap to allow or decline.</li>
        </ol>
        <p className="rounded-lg border border-slate-700 bg-slate-950/40 p-4 text-xs text-slate-400">
          NexCort iQ never accesses your camera without your explicit approval for each request.
          You can remove your registration at any time.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={WYZE_DEV_PORTAL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md border border-sky-700 px-4 py-2 font-medium text-sky-300 hover:border-sky-500"
          >
            Get {WYZE_TM} API Key →
          </a>
          <button
            type="button"
            className="inline-flex rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
            onClick={() => setStep("form")}
          >
            I have my API key
          </button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="space-y-4 text-center text-slate-300">
        <h2 className="text-xl font-semibold text-white">You&apos;re registered</h2>
        <p>
          {cameras > 0
            ? `${cameras} camera${cameras === 1 ? "" : "s"} registered for consent-based emergency sharing.`
            : "Registered successfully. Add cameras in the Wyze app and re-register to include them."}
        </p>
        <p className="rounded-lg border border-slate-700 bg-slate-950/40 p-4 text-left text-xs text-slate-400">
          When emergency responders need your camera feed, you&apos;ll receive a text message. Tap
          the link to approve or decline — you&apos;re always in control.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 text-sm text-slate-300">
      <button
        type="button"
        className="text-xs text-slate-500 hover:text-slate-300"
        onClick={() => setStep("intro")}
      >
        ← Back
      </button>
      {error ? (
        <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-red-300">{error}</p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Agency ID
        </span>
        <input
          required
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          placeholder="Provided by your PSAP / campus / venue"
          value={form.agencyId}
          onChange={updateField("agencyId")}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</span>
        <input
          required
          type="email"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          value={form.email}
          onChange={updateField("email")}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Mobile phone (US)
        </span>
        <input
          required
          type="tel"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          placeholder="+15551234567"
          value={form.phone}
          onChange={updateField("phone")}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {WYZE_TM} Key ID
        </span>
        <input
          required
          autoComplete="off"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          value={form.keyId}
          onChange={updateField("keyId")}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {WYZE_TM} API Key
        </span>
        <input
          required
          type="password"
          autoComplete="off"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          value={form.apiKey}
          onChange={updateField("apiKey")}
        />
        <span className="text-xs text-slate-500">Stored encrypted. Never used without your consent.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Street address
        </span>
        <input
          required
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          value={form.address}
          onChange={updateField("address")}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Latitude
          </span>
          <input
            required
            type="number"
            step="any"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={form.lat}
            onChange={updateField("lat")}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Longitude
          </span>
          <input
            required
            type="number"
            step="any"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={form.lng}
            onChange={updateField("lng")}
          />
        </label>
      </div>
      <button type="button" className="text-xs text-sky-400 underline" onClick={locateMe}>
        Use my current location
      </button>

      <p className="text-xs text-slate-500">
        By registering, you agree that emergency personnel may SMS you requesting temporary access
        to your camera during active nearby incidents. You may decline any request.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
      >
        {loading ? "Registering…" : "Register cameras"}
      </button>
    </form>
  );
}

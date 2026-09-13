"use client";

import { useEffect, useState } from "react";
import { GOOGLE_NEST_TM, NEST_TM } from "@/lib/brand-marks";
import { connectPublicApiBase } from "@/lib/connect-public-api";
import { marketingAppOrigin, marketingLoginPath } from "@/lib/marketing-links";

type Tab = "homeowner" | "agency";
type Screen = "intro" | "form" | "success";

function nestApiBase(): string {
  return connectPublicApiBase() || "https://api.rapidcortex.us";
}

function adminIntegrationsHref(): string {
  const origin = marketingAppOrigin() || "https://app.rapidcortex.us";
  return `${origin.replace(/\/$/, "")}/login`;
}

export function NestConnectEnrollment() {
  const [tab, setTab] = useState<Tab>("homeowner");
  const [screen, setScreen] = useState<Screen>("intro");
  const [form, setForm] = useState({
    agencyId: "",
    phone: "",
    address: "",
    lat: "",
    lng: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agency = params.get("agency")?.trim() ?? "";
    if (agency) setForm((f) => ({ ...f, agencyId: agency }));
    const result = params.get("nest");
    if (result === "connected") {
      setTab("homeowner");
      setScreen("success");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (result === "error") {
      setTab("homeowner");
      setScreen("form");
      setError("Google authorization failed or was cancelled. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function field(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function locateMe() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
      }));
    });
  }

  async function handleCitizenSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const lat = Number.parseFloat(form.lat);
    const lng = Number.parseFloat(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Enter a valid latitude and longitude, or use current location.");
      setLoading(false);
      return;
    }

    try {
      const phone = form.phone.trim().startsWith("+")
        ? form.phone.trim()
        : `+1${form.phone.replace(/\D/g, "")}`;
      const res = await fetch(`${nestApiBase()}/api/cameras/providers/nest/citizen/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId: form.agencyId.trim(),
          phone,
          address: form.address.trim(),
          lat,
          lng,
        }),
      });
      const json = (await res.json()) as { oauthUrl?: string; error?: string };
      if (!res.ok || !json.oauthUrl) {
        setError(json.error ?? "Registration failed.");
        setLoading(false);
        return;
      }
      window.location.href = json.oauthUrl;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-slate-700/80 bg-slate-950/40 p-6">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
          {GOOGLE_NEST_TM} Connect
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Consent-based emergency camera sharing
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Rapid Cortex never accesses your {NEST_TM} camera without your permission. Every request
          requires an explicit approval — by you, for each incident.
        </p>
      </div>

      <div className="mb-6 flex border-b border-slate-800">
        {(["homeowner", "agency"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`flex-1 py-2.5 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-sky-500 text-sky-400"
                : "border-b-2 border-transparent text-slate-500"
            }`}
            onClick={() => {
              setTab(t);
              setScreen("intro");
              setError("");
            }}
          >
            {t === "homeowner" ? "For homeowners" : "For agencies"}
          </button>
        ))}
      </div>

      {tab === "homeowner" && screen === "intro" ? (
        <div className="space-y-5">
          <ol className="space-y-4">
            {[
              ["1", "Register your address", "We use your location to match cameras to nearby incidents."],
              ["2", "Connect via Google", "One-tap OAuth — no API keys or passwords required."],
              [
                "3",
                "Approve each request",
                "You receive a text message for every emergency request. Tap to allow or decline.",
              ],
            ].map(([n, title, desc]) => (
              <li key={n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
                  {n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{title}</p>
                  <p className="text-sm text-slate-500">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
            <strong className="text-slate-100">What we access:</strong> camera list and live stream —
            only when you approve a specific request. We do not access motion history, recordings,
            thermostat data, or any other {NEST_TM} device.
          </p>
          <button
            type="button"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            onClick={() => setScreen("form")}
          >
            Register my {NEST_TM} cameras
          </button>
        </div>
      ) : null}

      {tab === "homeowner" && screen === "form" ? (
        <form onSubmit={(e) => void handleCitizenSubmit(e)} className="space-y-4">
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={() => setScreen("intro")}
          >
            ← Back
          </button>
          <h3 className="text-base font-semibold text-white">Your details</h3>
          {error ? (
            <div className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <label className="block text-xs text-slate-400">
            Agency ID (from your 911 center)
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              required
              placeholder="Provided by your local PSAP"
              value={form.agencyId}
              onChange={field("agencyId")}
            />
            <span className="mt-1 block text-[11px] text-slate-600">
              Enrollment is by invitation. Use the agency ID in your Rapid Cortex invite link.
            </span>
          </label>
          <label className="block text-xs text-slate-400">
            Mobile phone (US)
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              type="tel"
              required
              placeholder="+1 555 000 0000"
              value={form.phone}
              onChange={field("phone")}
            />
            <span className="mt-1 block text-[11px] text-slate-600">SMS consent requests arrive here.</span>
          </label>
          <label className="block text-xs text-slate-400">
            Street address
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              type="text"
              required
              placeholder="123 Main St, Anytown, ST 00000"
              value={form.address}
              onChange={field("address")}
            />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1 text-xs text-slate-400">
              Latitude
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                type="number"
                required
                step="any"
                placeholder="32.460976"
                value={form.lat}
                onChange={field("lat")}
              />
            </label>
            <label className="block flex-1 text-xs text-slate-400">
              Longitude
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                type="number"
                required
                step="any"
                placeholder="-84.987126"
                value={form.lng}
                onChange={field("lng")}
              />
            </label>
          </div>
          <button
            type="button"
            className="text-sm text-sky-400 underline-offset-2 hover:underline"
            onClick={locateMe}
          >
            Use my current location
          </button>
          <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
            After submitting, you will be redirected to Google to authorize Rapid Cortex. Citizen
            enrollment requires Rapid Cortex’s own Google Device Access project — if that is not
            approved yet, registration returns an error until it is.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
          >
            {loading ? "Redirecting to Google…" : "Continue to Google"}
          </button>
        </form>
      ) : null}

      {tab === "homeowner" && screen === "success" ? (
        <div className="space-y-3 text-center">
          <h3 className="text-lg font-semibold text-white">You are registered</h3>
          <p className="text-sm leading-relaxed text-slate-400">
            Your {NEST_TM} cameras are available for consent-based emergency sharing. You will
            receive a text message for each request — you stay in control.
          </p>
        </div>
      ) : null}

      {tab === "agency" ? (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-slate-400">
            Agencies link their own Google Device Access project to view agency-owned {NEST_TM}{" "}
            cameras in the dispatcher workspace. Citizen cameras use a separate consent flow.
          </p>
          <ol className="space-y-4">
            {[
              [
                "1",
                "Create a Device Access project",
                "Visit console.nest.google.com/device-access, create a project, and note your Project ID.",
              ],
              [
                "2",
                "Create an OAuth 2.0 client",
                "In Google Cloud Console → APIs & Services → Credentials, create an OAuth client. Set the redirect URI to the Rapid Cortex API callback URL.",
              ],
              [
                "3",
                "Link in Rapid Cortex Settings",
                "Go to Admin → Integrations → Google Nest, enter Project ID, Client ID, and Client Secret, then Connect.",
              ],
            ].map(([n, title, desc]) => (
              <li key={n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
                  {n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{title}</p>
                  <p className="text-sm text-slate-500">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
            Redirect URI:{" "}
            <code className="text-xs text-sky-400">
              https://api.rapidcortex.us/api/cameras/providers/nest/callback
            </code>
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://console.nest.google.com/device-access"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-md border border-sky-800 px-4 py-2 text-sm font-medium text-sky-300 hover:border-sky-600"
            >
              Open Device Access Console →
            </a>
            <a
              href={adminIntegrationsHref()}
              className="inline-flex rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Agency sign-in
            </a>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex gap-5 border-t border-slate-800 pt-4 text-xs text-slate-600">
        <a href="/privacy/" className="hover:text-slate-400">
          Privacy policy
        </a>
        <a href={marketingLoginPath()} className="hover:text-slate-400">
          Agency login
        </a>
      </div>
    </div>
  );
}

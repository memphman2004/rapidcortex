"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"],
  ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"],
  ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

type Agency = {
  agencyId: string;
  name: string;
  city: string;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; agencies: Agency[] }
  | { status: "empty" }
  | { status: "soft_empty" };

// Public agencies + leads APIs live on Stack 4.
const API_BASE = process.env.NEXT_PUBLIC_RING_PUBLIC_OAUTH_BASE ?? "";

function parseAgenciesPayload(data: unknown): Agency[] {
  if (Array.isArray(data)) {
    return data
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          agencyId: String(r.agencyId ?? r.agencySlug ?? ""),
          name: String(r.name ?? r.publicDisplayName ?? r.displayName ?? ""),
          city: String(r.city ?? r.publicCity ?? ""),
        };
      })
      .filter((a) => a.agencyId && a.name);
  }
  if (data && typeof data === "object" && Array.isArray((data as { agencies?: unknown }).agencies)) {
    return ((data as { agencies: unknown[] }).agencies)
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          agencyId: String(r.agencyId ?? r.agencySlug ?? ""),
          name: String(r.name ?? r.publicDisplayName ?? r.displayName ?? ""),
          city: String(r.city ?? r.publicCity ?? ""),
        };
      })
      .filter((a) => a.agencyId && a.name);
  }
  return [];
}

function EmailWaitlist({ stateCode }: { stateCode: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"idle" | "ok" | "err">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "ring-connect-waitlist",
          requestedState: stateCode || null,
          requestedCity: null,
        }),
      });
      setOutcome(res.ok ? "ok" : "err");
    } catch {
      setOutcome("err");
    } finally {
      setBusy(false);
    }
  }

  if (outcome === "ok") {
    return (
      <p className="mt-3 text-sm text-emerald-400">
        You&apos;re on the list — we&apos;ll reach out when enrollment opens in your area. You can
        still enable Rapid Cortex Connect in the Ring™ Appstore anytime.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <p className="text-xs text-slate-400">
        Leave your email and we&apos;ll notify you when a local agency enrolls. Enabling Rapid Cortex
        Connect in Ring™ now still helps you stay ready.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          placeholder="your@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-950/40 px-5 text-sm font-semibold text-sky-100 disabled:opacity-60 hover:border-sky-400/60"
        >
          {busy ? "Sending…" : "Notify me"}
        </button>
      </div>
      {outcome === "err" && (
        <p className="text-xs text-rose-400">
          Something went wrong — please try again or contact support.
        </p>
      )}
    </form>
  );
}

export function RingConnectFlow() {
  const searchParams = useSearchParams();
  const agencyIdFromUrl = searchParams.get("agencyId")?.trim() || null;

  const [selectedState, setSelectedState] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(agencyIdFromUrl);
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (agencyIdFromUrl) {
      setSelectedAgencyId(agencyIdFromUrl);
    }
  }, [agencyIdFromUrl]);

  useEffect(() => {
    if (!selectedState) {
      setFetchState({ status: "idle" });
      if (!agencyIdFromUrl) setSelectedAgencyId(null);
      return;
    }
    let stale = false;
    setFetchState({ status: "loading" });
    if (!agencyIdFromUrl) setSelectedAgencyId(null);

    fetch(`${API_BASE}/api/public/agencies/by-state?state=${encodeURIComponent(selectedState)}`)
      .then(async (r) => {
        const data: unknown = await r.json().catch(() => ({ agencies: [] }));
        if (stale) return;
        const agencies = r.ok ? parseAgenciesPayload(data) : [];
        if (agencies.length > 0) {
          setFetchState({ status: "loaded", agencies });
        } else {
          setFetchState({ status: r.ok ? "empty" : "soft_empty" });
        }
      })
      .catch(() => {
        if (!stale) setFetchState({ status: "soft_empty" });
      });

    return () => {
      stale = true;
    };
  }, [selectedState, agencyIdFromUrl]);

  const stateName = US_STATES.find(([c]) => c === selectedState)?.[1] ?? selectedState;
  const selectedAgencyName =
    fetchState.status === "loaded"
      ? fetchState.agencies.find((a) => a.agencyId === selectedAgencyId)?.name
      : null;
  const showWaitlist = fetchState.status === "empty" || fetchState.status === "soft_empty";

  return (
    <section className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-slate-300">
      <div>
        <h2 className="text-base font-semibold text-white">Ready to help your community?</h2>
        <p className="mt-1 text-xs text-slate-400">Takes about a minute in the Ring™ app.</p>
        <p className="mt-4 leading-relaxed">
          Rapid Cortex Connect lets local emergency agencies request temporary, consent-gated access
          to your Ring™ devices during active nearby incidents. Ring™ Device Owners enroll through the{" "}
          <strong className="text-white">Ring™ Appstore</strong> — not agency dispatcher login. Your
          devices, your choice — every request requires your approval.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-sky-500/25 bg-sky-950/30 p-5">
        <h3 className="text-sm font-semibold text-white">Enable Rapid Cortex Connect</h3>
        {selectedAgencyName ? (
          <p className="text-xs text-slate-400">
            When prompted for your local agency, select{" "}
            <strong className="text-slate-200">{selectedAgencyName}</strong> if available.
          </p>
        ) : null}
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-200">
          <li>
            Open the <strong className="text-white">Ring™</strong> app on your phone
          </li>
          <li>
            Go to the <strong className="text-white">Ring™ Appstore</strong>
          </li>
          <li>
            Search for <strong className="text-white">Rapid Cortex Connect</strong>
          </li>
          <li>
            Tap <strong className="text-white">Get App</strong>, choose your devices, and confirm
          </li>
          <li>
            If Ring™ shows <strong className="text-white">Pending — App sign-in required</strong>, tap
            Sign in and create or use your Rapid Cortex device-owner account (email + password — not
            dispatcher login)
          </li>
        </ol>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href="https://ring.com/pages/appstore/rapid-cortex-connect"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
          >
            Open Rapid Cortex Connect in Ring™
          </a>
          <a
            href="https://ring.com/app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
          >
            Get the Ring™ app
          </a>
        </div>
        <p className="text-xs leading-relaxed text-amber-200/90">
          Requires an active Ring™ Protect plan. If you don&apos;t have one, you&apos;ll be prompted
          to subscribe during setup.
        </p>
        <p className="text-xs leading-relaxed text-slate-400">
          After you&apos;re Connected, participating agencies can request temporary camera access
          only for qualifying nearby incidents — and only when you tap Allow on each SMS request.
        </p>
      </div>

      {/* Optional agency lookup */}
      <div className="space-y-3">
        <label htmlFor="ring-connect-state" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Find your local agency (optional)
        </label>
        <select
          id="ring-connect-state"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          aria-label="Select your state"
          className="w-full max-w-xs rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
        >
          <option value="">Select your state…</option>
          {US_STATES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>

        {fetchState.status === "loading" && (
          <p className="text-xs text-slate-400">Finding agencies in {stateName}…</p>
        )}

        {fetchState.status === "loaded" && (
          <ul className="space-y-2">
            {fetchState.agencies.map((agency) => {
              const selected = selectedAgencyId === agency.agencyId;
              return (
                <li key={agency.agencyId}>
                  <button
                    type="button"
                    onClick={() => setSelectedAgencyId(agency.agencyId)}
                    className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition ${
                      selected
                        ? "border-sky-500/60 bg-sky-950/40"
                        : "border-slate-700 bg-slate-900/40 hover:border-slate-500"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">{agency.name}</p>
                      {agency.city ? (
                        <p className="text-xs text-slate-500">
                          {agency.city}
                          {selectedState ? `, ${selectedState}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-sky-300">
                      {selected ? "Selected" : "Select"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {showWaitlist && (
          <div className="rounded-lg border border-sky-500/20 bg-sky-950/30 px-4 py-3">
            <p className="text-sm leading-relaxed text-slate-300">
              No agencies in {stateName || "your area"} have enrolled yet — you can still enable
              Rapid Cortex Connect in Ring™ now, and join the waitlist below.
            </p>
            <EmailWaitlist stateCode={selectedState} />
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-white/10 pt-5">
        <p className="text-xs leading-relaxed text-slate-400">
          Every video request is approved separately. When a nearby incident involves your address,
          you get an SMS with Allow, Decline, and Stop Sharing. You decide — every time.
        </p>
        <p className="text-xs leading-relaxed text-slate-500">
          Don&apos;t have a Ring™ account?{" "}
          <a
            href="https://ring.com/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 underline hover:text-sky-300"
          >
            Create one at ring.com
          </a>
          , then enable Rapid Cortex Connect in the Ring™ Appstore.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href="mailto:support@rapidcortex.us?subject=Ring%20Connect%20device%20owner%20enrollment"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
        >
          Contact support
        </a>
        <a
          href="/legal/privacy/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
        >
          Privacy policy
        </a>
      </div>
    </section>
  );
}

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
  agencySlug: string;
  displayName: string;
  city: string;
  state: string;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; agencies: Agency[] }
  | { status: "empty" }
  | { status: "error" };

// All Ring public API routes (agencies, leads, OAuth) live on Stack 4.
const OAUTH_BASE = process.env.NEXT_PUBLIC_RING_PUBLIC_OAUTH_BASE ?? "";

function EmailWaitlist({ stateCode }: { stateCode: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"idle" | "ok" | "err">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${OAUTH_BASE}/api/public/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "ring-connect-waitlist",
          requestedState: stateCode,
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
      <p className="mt-4 text-sm text-emerald-400">
        You&apos;re on the list — we&apos;ll reach out when enrollment opens in your area.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <p className="text-xs text-slate-400">
        No agencies are listed in your area yet. Enter your email and we&apos;ll reach out when
        enrollment opens.
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
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950 disabled:opacity-60"
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
  const agencyId = searchParams.get("agencyId");

  const [selectedState, setSelectedState] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (!selectedState) {
      setFetchState({ status: "idle" });
      return;
    }
    let stale = false;
    setFetchState({ status: "loading" });
    fetch(`${OAUTH_BASE}/api/public/agencies/by-state?state=${selectedState}`)
      .then((r) => r.json())
      .then((data: Agency[]) => {
        if (stale) return;
        setFetchState(
          Array.isArray(data) && data.length > 0
            ? { status: "loaded", agencies: data }
            : { status: "empty" }
        );
      })
      .catch(() => {
        if (!stale) setFetchState({ status: "error" });
      });
    return () => {
      stale = true;
    };
  }, [selectedState]);

  function oauthStart(slug: string) {
    window.location.href = `${OAUTH_BASE}/api/public/ring/oauth/start?agencyId=${encodeURIComponent(slug)}`;
  }

  const stateName = US_STATES.find(([c]) => c === selectedState)?.[1] ?? selectedState;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-slate-300">
      <h2 className="text-base font-semibold text-white">Ready to help your community?</h2>
      <p className="mt-1 text-xs text-slate-400">Takes about 60 seconds from the Ring app.</p>

      <p className="mt-4 leading-relaxed">
        Rapid Cortex lets local emergency agencies request temporary, consent-gated access to your
        Ring cameras during active nearby incidents. Your cameras, your choice — every request
        requires your approval, nothing is automatic, and you can disconnect at any time.
      </p>

      <p className="mt-3 leading-relaxed">
        The easiest way to connect is directly from the Ring app: open Ring → Skills → search for
        Rapid Cortex → Enable. You&apos;ll be guided to select your local agency and complete the
        link in under a minute.
      </p>

      {!agencyId && (
        <p className="mt-3 leading-relaxed">
          Or select your state below to find your local agency. If no agencies are listed in your
          area yet, enter your email and we&apos;ll reach out when enrollment opens.
        </p>
      )}

      {/* Path 2: agencyId present in URL — direct OAuth button shown above picker */}
      {agencyId ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => oauthStart(agencyId)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
          >
            Link my Ring account →
          </button>
        </div>
      ) : null}

      {/* State picker (paths 1 and 3) */}
      <div className="mt-5">
        <select
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
      </div>

      {fetchState.status === "loading" && (
        <p className="mt-4 text-xs text-slate-400">Finding agencies in {stateName}…</p>
      )}

      {fetchState.status === "loaded" && (
        <ul className="mt-4 space-y-2">
          {fetchState.agencies.map((agency) => (
            <li
              key={agency.agencySlug}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">{agency.displayName}</p>
                <p className="text-xs text-slate-500">
                  {agency.city}, {agency.state}
                </p>
              </div>
              <button
                type="button"
                onClick={() => oauthStart(agency.agencySlug)}
                className="inline-flex shrink-0 min-h-9 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-xs font-semibold text-slate-950"
              >
                Connect →
              </button>
            </li>
          ))}
        </ul>
      )}

      {fetchState.status === "empty" && <EmailWaitlist stateCode={selectedState} />}

      {fetchState.status === "error" && (
        <p className="mt-4 text-xs text-rose-400">
          Unable to load agencies right now — try again or contact support.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href="mailto:support@rapidcortex.us?subject=Ring%20Connect%20homeowner%20enrollment"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
        >
          Contact support
        </a>
        <a
          href="/privacy"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
        >
          Privacy policy
        </a>
      </div>
    </section>
  );
}

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

// All Ring public API routes (agencies, OAuth) live on Stack 4.
const OAUTH_BASE = process.env.NEXT_PUBLIC_RING_PUBLIC_OAUTH_BASE ?? "";

function parseAgenciesPayload(data: unknown): Agency[] {
  if (Array.isArray(data)) {
    // Legacy raw-array response
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

    fetch(`${OAUTH_BASE}/api/public/agencies/by-state?state=${encodeURIComponent(selectedState)}`)
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

  function startRingConnect() {
    const params = new URLSearchParams();
    if (selectedAgencyId) params.set("agencyId", selectedAgencyId);
    if (selectedState) params.set("state", selectedState);
    const qs = params.toString();
    window.location.href = `${OAUTH_BASE}/api/public/ring/oauth/start${qs ? `?${qs}` : ""}`;
  }

  const stateName = US_STATES.find(([c]) => c === selectedState)?.[1] ?? selectedState;
  const selectedAgencyName =
    fetchState.status === "loaded"
      ? fetchState.agencies.find((a) => a.agencyId === selectedAgencyId)?.name
      : null;

  return (
    <section className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-slate-300">
      <div>
        <h2 className="text-base font-semibold text-white">Ready to help your community?</h2>
        <p className="mt-1 text-xs text-slate-400">Takes about 60 seconds from the Ring app or web.</p>
        <p className="mt-4 leading-relaxed">
          Rapid Cortex lets local emergency agencies request temporary, consent-gated access to your
          Ring cameras during active nearby incidents. Your cameras, your choice — every request
          requires your approval, nothing is automatic, and you can disconnect at any time.
        </p>
      </div>

      {/* Optional agency matching — never blocks Connect */}
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

        {(fetchState.status === "empty" || fetchState.status === "soft_empty") && (
          <p className="rounded-lg border border-sky-500/20 bg-sky-950/30 px-4 py-3 text-sm leading-relaxed text-slate-300">
            No agencies in your area have enrolled yet — but{" "}
            <strong className="text-white">you can still connect now</strong>. When local emergency
            services join Rapid Cortex, you&apos;ll already be registered.
          </p>
        )}

        {agencyIdFromUrl && !selectedState ? (
          <p className="text-xs text-slate-400">
            Agency link detected. You can connect directly, or pick a state to confirm your local
            agency.
          </p>
        ) : null}
      </div>

      {/* Connect — always available */}
      <div className="space-y-3 border-t border-white/10 pt-5">
        <p className="text-xs leading-relaxed text-slate-400">
          Every video request is approved separately. When a nearby incident involves your address,
          dispatchers can request temporary access. You decide — every time.
        </p>
        <button
          type="button"
          onClick={startRingConnect}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
        >
          {selectedAgencyName ? `Connect to ${selectedAgencyName}` : "Connect with Ring"}
        </button>
        <p className="text-xs leading-relaxed text-slate-500">
          By connecting, you agree that dispatchers at participating agencies may request temporary
          camera access during active incidents near your address.{" "}
          <strong className="text-slate-300">Every request requires your individual approval.</strong>
        </p>
        <p className="text-xs text-slate-400">
          Don&apos;t have a Ring account?{" "}
          <a
            href="https://ring.com/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 underline hover:text-sky-300"
          >
            Create one at ring.com
          </a>
          , then return here to connect.
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
          href="/privacy"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
        >
          Privacy policy
        </a>
      </div>
    </section>
  );
}

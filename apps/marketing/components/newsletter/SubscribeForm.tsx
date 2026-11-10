"use client";

import { useState, type FormEvent } from "react";
import { buildMarketingLeadRequestBody } from "rapid-cortex-shared";
import { VERTICAL_LABELS, type Vertical } from "@/lib/newsletter/newsletter-data";

const DEFAULT_MARKETING_LEAD_URL =
  "https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com/api/marketing/lead";

function marketingLeadSubmitUrl(): string {
  const override = process.env.NEXT_PUBLIC_MARKETING_LEAD_URL?.trim();
  if (override) return override;
  return DEFAULT_MARKETING_LEAD_URL;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const;

type View = "form" | "submitting" | "success" | "duplicate";

/**
 * Optional inbox signup for The NexCortiQ Signal — never gates reading.
 * Posts to marketing lead API (business email) and logs vertical preference via utmContent.
 */
export function SubscribeForm({ compact = false }: { compact?: boolean }) {
  const [view, setView] = useState<View>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [vertical, setVertical] = useState<Vertical | "">("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    const built = buildMarketingLeadRequestBody(
      { firstName, lastName, email, state },
      {
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        landingPage:
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/newsletter",
        capturedAt: new Date().toISOString(),
        utmSource: "newsletter",
        utmMedium: "web",
        utmCampaign: "nexcortiq-signal",
        utmContent: vertical || undefined,
      },
    );
    if (!built.ok) {
      setFieldErrors(built.fieldErrors);
      return;
    }
    setFieldErrors({});
    setView("submitting");

    // Preference log on app host (marketing is static export — no local API routes).
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "") ?? "https://app.rapidcortex.us";
    void fetch(`${appOrigin}/api/newsletter-subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: built.body.email, vertical: vertical || undefined }),
    }).catch(() => undefined);

    try {
      const res = await fetch(marketingLeadSubmitUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(built.body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        duplicate?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setApiError(data.error ?? `Request failed (${res.status})`);
        setView("form");
        return;
      }
      setView(data.duplicate ? "duplicate" : "success");
    } catch {
      setApiError("Could not reach the signup service. Try again later.");
      setView("form");
    }
  }

  if (view === "success" || view === "duplicate") {
    return (
      <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-sky-400">You’re on the list</p>
        <p className="mt-2 text-sm text-slate-300">
          {view === "duplicate"
            ? "This business email is already subscribed. Full Signal editions stay free to read on this site."
            : "Thanks. We’ll email a short preview when the next Signal posts. Unsubscribe anytime via the link in our emails."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          : "rounded-lg border border-slate-800 bg-slate-900/40 p-6"
      }
    >
      <h2 className="text-lg font-semibold text-white">Get the NexCortiQ Signal in Your Inbox</h2>
      <p className="mt-2 text-sm text-slate-400">
        Monthly intelligence for 911 directors, campus safety officers, transit security managers,
        and venue operations professionals. Reading never requires a subscription.{" "}
        <a href="/unsubscribe" className="text-sky-400 hover:text-sky-300">
          Opt out
        </a>{" "}
        anytime.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2" noValidate>
        <div>
          <label htmlFor="signal-first" className="sr-only">
            First name
          </label>
          <input
            id="signal-first"
            placeholder="First name"
            value={firstName}
            onChange={(ev) => setFirstName(ev.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none"
          />
          {fieldErrors.firstName ? (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.firstName}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="signal-last" className="sr-only">
            Last name
          </label>
          <input
            id="signal-last"
            placeholder="Last name"
            value={lastName}
            onChange={(ev) => setLastName(ev.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none"
          />
          {fieldErrors.lastName ? (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.lastName}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="signal-email" className="sr-only">
            Business email
          </label>
          <input
            id="signal-email"
            type="email"
            placeholder="Business email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none"
          />
          {fieldErrors.email ? (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="signal-state" className="sr-only">
            State
          </label>
          <select
            id="signal-state"
            value={state}
            onChange={(ev) => setState(ev.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500/60 focus:outline-none"
          >
            <option value="">State</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {fieldErrors.state ? (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.state}</p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="signal-vertical" className="mb-1 block text-xs text-slate-500">
            I work in (optional)
          </label>
          <select
            id="signal-vertical"
            value={vertical}
            onChange={(ev) => setVertical(ev.target.value as Vertical | "")}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500/60 focus:outline-none sm:max-w-xs"
          >
            <option value="">Prefer not to say</option>
            {(Object.keys(VERTICAL_LABELS) as Vertical[]).map((v) => (
              <option key={v} value={v}>
                {VERTICAL_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          {apiError ? <p className="mb-2 text-xs text-red-400">{apiError}</p> : null}
          <button
            type="submit"
            disabled={view === "submitting"}
            className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
          >
            {view === "submitting" ? "Submitting…" : "Get email previews"}
          </button>
        </div>
      </form>
    </div>
  );
}

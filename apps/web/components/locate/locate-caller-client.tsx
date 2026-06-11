"use client";

import { useCallback, useEffect, useState } from "react";

type LocateView = {
  valid: boolean;
  status: string;
  vertical: "campus" | "venue" | "911";
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error("empty");
  return JSON.parse(text) as T;
}

function apiPath(token: string) {
  return `/api/public/locate/${encodeURIComponent(token)}`;
}

function verticalAccent(vertical: LocateView["vertical"]): string {
  if (vertical === "venue") return "text-amber-300";
  return "text-emerald-300";
}

function verticalBg(vertical: LocateView["vertical"]): string {
  if (vertical === "venue") return "bg-amber-500";
  return "bg-emerald-500";
}

export function LocateCallerClient({ token }: { token: string }) {
  const [view, setView] = useState<LocateView | null>(null);
  const [phase, setPhase] = useState<"loading" | "sharing" | "success" | "denied" | "expired" | "done">("loading");
  const [manualText, setManualText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(apiPath(token), { cache: "no-store" });
    if (res.status === 410) {
      setPhase("expired");
      return;
    }
    if (!res.ok) {
      setErr("This link is not valid.");
      setPhase("expired");
      return;
    }
    const data = await readJson<LocateView>(res);
    setView(data);
    if (!data.valid || data.status === "EXPIRED") {
      setPhase("expired");
      return;
    }
    if (data.status === "RECEIVED") {
      setPhase("done");
      return;
    }
    setPhase("sharing");
  }, [token]);

  const postPayload = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(apiPath(token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setPhase("done");
        return;
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Could not send location.");
      }
      setPhase("success");
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase !== "sharing" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void postPayload({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? undefined,
          source: "GPS",
        }).catch((e: Error) => {
          setErr(e.message);
          setPhase("denied");
        });
      },
      () => setPhase("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }, [phase, postPayload]);

  const vertical = view?.vertical ?? "campus";
  const accent = verticalAccent(vertical);
  const pulse = verticalBg(vertical);

  if (phase === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#071510] px-6 text-center text-white">
        <p className="text-lg text-slate-300">Loading…</p>
      </main>
    );
  }

  if (phase === "expired") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#071510] px-6 text-center text-white">
        <h1 className="text-2xl font-semibold">Link expired</h1>
        <p className="mt-3 max-w-sm text-base text-slate-400">
          This location link is no longer active. Reply to your text with your exact location.
        </p>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#071510] px-6 text-center text-white">
        <h1 className="text-2xl font-semibold">Location already shared</h1>
        <p className="mt-3 max-w-sm text-base text-slate-400">Security has your location. Help is on the way.</p>
      </main>
    );
  }

  if (phase === "sharing") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#071510] px-6 text-center text-white">
        <div className={`mx-auto mb-6 h-4 w-4 animate-pulse rounded-full ${pulse}`} />
        <h1 className={`text-2xl font-semibold ${accent}`}>Sharing your location with security…</h1>
        <p className="mt-4 max-w-sm text-base text-slate-400">
          Allow location access when your phone asks. This helps responders find you faster.
        </p>
        {err ? <p className="mt-4 text-sm text-amber-200">{err}</p> : null}
      </main>
    );
  }

  if (phase === "success") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#071510] px-6 text-center text-white">
        <div className={`relative mx-auto mb-8 h-16 w-16`}>
          <span className={`absolute inset-0 animate-ping rounded-full opacity-40 ${pulse}`} />
          <span className={`relative block h-16 w-16 rounded-full ${pulse}`} />
        </div>
        <h1 className="text-2xl font-semibold">Location shared</h1>
        <p className="mt-3 max-w-sm text-lg text-slate-300">Help is on the way.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#071510] px-6 text-white">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold">Location not shared</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400">
          Please reply to the text with your exact location — building name, floor, and room number — or type it
          below.
        </p>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          rows={4}
          placeholder="e.g. McKinley Hall, 2nd floor, room 204"
          className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white placeholder:text-slate-600"
        />
        <button
          type="button"
          disabled={submitting || manualText.trim().length < 3}
          onClick={() => {
            setSubmitting(true);
            void postPayload({ locationText: manualText.trim(), source: "MANUAL" })
              .catch((e: Error) => setErr(e.message))
              .finally(() => setSubmitting(false));
          }}
          className={`mt-4 w-full rounded-lg py-3 text-base font-semibold text-black disabled:opacity-50 ${vertical === "venue" ? "bg-amber-400 hover:bg-amber-300" : "bg-emerald-400 hover:bg-emerald-300"}`}
        >
          {submitting ? "Sending…" : "Send location"}
        </button>
        {err ? <p className="mt-3 text-sm text-amber-200">{err}</p> : null}
      </div>
    </main>
  );
}

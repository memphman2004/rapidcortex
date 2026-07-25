"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { isNg911AssistEnabled } from "@/lib/runtime-flags";

type Step = "key" | "utterance" | "confirm" | "done";

export default function PublicDiversionPage() {
  const params = useParams<{ agencyId: string }>();
  const agencyId = params.agencyId;

  const [step, setStep] = useState<Step>("key");
  const [diversionKey, setDiversionKey] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");
  const [utterance, setUtterance] = useState("");
  const [phone, setPhone] = useState("");
  const [matchName, setMatchName] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isNg911AssistEnabled()) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-slate-300">
        <h1 className="text-xl font-semibold text-white">Non-emergency reporting</h1>
        <p className="mt-2 text-sm text-slate-400">This service is not available right now.</p>
      </main>
    );
  }

  async function post(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/diversion/${encodeURIComponent(agencyId)}/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-diversion-key": diversionKey.trim(),
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          (typeof data.error === "string" && data.error) || `Request failed (${res.status})`,
        );
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12 text-slate-300">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Non-emergency line
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-white">Online diversion</h1>
      <p className="mt-2 text-sm text-slate-400">
        If this is an emergency, hang up and dial 9-1-1. Do not use this form for life-threatening
        situations.
      </p>

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

      {step === "key" ? (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const data = await post("start", { callerPhoneE164: phone.trim() || undefined });
              setSessionId(String(data.sessionId ?? ""));
              setGreeting(typeof data.greeting === "string" ? data.greeting : "");
              setStep("utterance");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to start session");
            }
          }}
        >
          <label className="block text-xs text-slate-400">
            Agency diversion key
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={diversionKey}
              onChange={(e) => setDiversionKey(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Callback phone (E.164, optional now)
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !diversionKey.trim()}
            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {busy ? "Starting…" : "Continue"}
          </button>
        </form>
      ) : null}

      {step === "utterance" && sessionId ? (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const data = await post("utterance", { sessionId, utterance: utterance.trim() });
              const matched =
                typeof data.matchedWorkflowName === "string" ? data.matchedWorkflowName : null;
              setMatchName(matched);
              if (matched) setStep("confirm");
              else {
                setResultMessage(
                  typeof data.message === "string"
                    ? data.message
                    : "No matching online reporting option. Please stay on the line for an operator.",
                );
                setStep("done");
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to process request");
            }
          }}
        >
          {greeting ? <p className="text-sm text-slate-300">{greeting}</p> : null}
          <label className="block text-xs text-slate-400">
            Briefly describe why you are calling
            <textarea
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              rows={4}
              value={utterance}
              onChange={(e) => setUtterance(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy || !utterance.trim()}
            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {busy ? "Matching…" : "Submit"}
          </button>
        </form>
      ) : null}

      {step === "confirm" && sessionId ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-slate-300">
            We can send you a link for <strong className="text-white">{matchName}</strong>. Confirm to
            receive an SMS with the reporting portal.
          </p>
          <label className="block text-xs text-slate-400">
            Mobile number for SMS (E.164)
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !phone.trim()}
              className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              onClick={async () => {
                try {
                  const data = await post("confirm", {
                    sessionId,
                    confirm: true,
                    callerPhoneE164: phone.trim(),
                  });
                  setResultMessage(
                    typeof data.message === "string"
                      ? data.message
                      : "A text message with the reporting link has been sent.",
                  );
                  setStep("done");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to confirm");
                }
              }}
            >
              {busy ? "Sending…" : "Yes, send the link"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-50"
              onClick={async () => {
                try {
                  const data = await post("confirm", { sessionId, confirm: false });
                  setResultMessage(
                    typeof data.message === "string"
                      ? data.message
                      : "You will be connected to a live operator.",
                  );
                  setStep("done");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to opt out");
                }
              }}
            >
              Speak with an operator
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <p className="mt-8 text-sm text-emerald-300">{resultMessage ?? "Session complete."}</p>
      ) : null}
    </main>
  );
}

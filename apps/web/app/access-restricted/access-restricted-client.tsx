"use client";

import type { AccessCheckResult } from "rapid-cortex-shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { marketingDashboardPath, marketingLoginPath } from "@/lib/marketing-links";

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function useCountdownTo(iso: string | undefined): string | null {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  return useMemo(() => {
    if (!iso) return null;
    const target = new Date(iso).getTime();
    const sec = Math.max(0, Math.floor((target - nowMs) / 1000));
    return formatCountdown(sec);
  }, [iso, nowMs]);
}

export function AccessRestrictedClient() {
  const searchParams = useSearchParams();
  const reasonParam = searchParams.get("reason") ?? "";
  const retryParam = searchParams.get("retryAfter") ?? "";

  const [status, setStatus] = useState<"loading" | "ok" | "unauth" | "blocked" | "allowed">(
    "loading",
  );
  const [check, setCheck] = useState<AccessCheckResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestOk, setRequestOk] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const blockedBy =
    check?.allowed === false ? check.blockedBy : reasonParam === "time_restriction"
      ? "time_restriction"
      : reasonParam === "ip_allowlist"
        ? "ip_allowlist"
        : reasonParam || "ip_allowlist";

  const retryAfter = check?.retryAfter || retryParam || undefined;
  const shiftTz = check?.shiftTimezone;
  const countdown = useCountdownTo(retryAfter);

  const loadCheck = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/backend/api/agency/network-policy-check", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        setStatus("unauth");
        return;
      }
      if (!res.ok) {
        setStatus("blocked");
        return;
      }
      const json = (await res.json()) as { data?: AccessCheckResult };
      const data = json.data;
      if (!data) {
        setStatus("blocked");
        return;
      }
      if (data.allowed) {
        setStatus("allowed");
        window.location.href = marketingDashboardPath();
        return;
      }
      setCheck(data);
      setStatus("blocked");
    } catch {
      setStatus("blocked");
    }
  }, []);

  useEffect(() => {
    void loadCheck();
  }, [loadCheck]);

  const nextWindowLabel = useMemo(() => {
    if (!retryAfter) return null;
    try {
      return new Intl.DateTimeFormat("en-US", {
        ...(shiftTz ? { timeZone: shiftTz } : {}),
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(retryAfter));
    } catch {
      return new Date(retryAfter).toLocaleString();
    }
  }, [retryAfter, shiftTz]);

  const submitEmergencyRequest = async () => {
    setRequestError(null);
    const trimmed = reasonText.trim();
    if (trimmed.length < 3) {
      setRequestError("Please enter a reason (at least a few words).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/backend/api/agency/emergency-override-request", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setRequestError(typeof json?.error === "string" ? json.error : "Request could not be sent.");
        return;
      }
      setRequestOk(true);
      setModalOpen(false);
      setReasonText("");
    } catch {
      setRequestError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "allowed") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-slate-300">
        <p className="text-sm">{status === "allowed" ? "Redirecting…" : "Checking access…"}</p>
      </div>
    );
  }

  if (status === "unauth") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
        <h1 className="text-xl font-semibold">Sign in required</h1>
        <p className="mt-4 max-w-md text-sm text-slate-400">
          Your session is not available. Sign in again to continue.
        </p>
        <Link href={marketingLoginPath()} className="mt-8 text-sky-400 underline hover:text-sky-300">
          Return to sign in
        </Link>
      </div>
    );
  }

  const isIp = blockedBy === "ip_allowlist";
  const maskedIp = check?.maskedClientIp;
  const showEmergency =
    blockedBy === "time_restriction" && check?.allowEmergencyOverride === true;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 py-16 text-center text-slate-100">
      <h1 className="text-xl font-semibold tracking-tight">
        {isIp ? "Network not authorized" : "Outside shift hours"}
      </h1>

      {isIp ? (
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
          Your network is not authorized for Rapid Cortex. Contact your agency IT administrator to add
          your network.
        </p>
      ) : (
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
          Access is only available during shift hours.
          {nextWindowLabel ? (
            <>
              {" "}
              Next access window opens:{" "}
              <span className="font-medium text-slate-200">{nextWindowLabel}</span>
            </>
          ) : null}
        </p>
      )}

      {isIp && maskedIp ? (
        <p className="mt-6 text-sm text-slate-500">
          Your IP: <span className="font-mono text-slate-300">{maskedIp}</span>
        </p>
      ) : null}

      {!isIp && retryAfter && countdown ? (
        <p className="mt-6 text-sm text-slate-500">
          Time until access opens: <span className="font-mono text-slate-300">{countdown}</span>
        </p>
      ) : null}

      <div className="mt-10 flex flex-col gap-3 text-sm">
        <button
          type="button"
          className="rounded-md border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
          onClick={() => void loadCheck()}
        >
          Check again
        </button>
        {showEmergency ? (
          <button
            type="button"
            className="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500"
            onClick={() => {
              setRequestError(null);
              setModalOpen(true);
            }}
          >
            Request emergency access
          </button>
        ) : !isIp && blockedBy === "time_restriction" ? (
          <p className="max-w-md text-slate-500">
            Contact your agency IT administrator or supervisor directly for access outside normal hours.
          </p>
        ) : null}
        {requestOk ? (
          <p className="text-emerald-400">Request sent. An administrator will be notified.</p>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 text-left shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100">Emergency access request</h2>
            <p className="mt-2 text-sm text-slate-400">
              Describe the operational reason (e.g. major weather event). An agency administrator will
              review your request.
            </p>
            <textarea
              className="mt-4 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              rows={4}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Reason (required)"
            />
            {requestError ? <p className="mt-2 text-sm text-red-400">{requestError}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                onClick={() => void submitEmergencyRequest()}
              >
                {submitting ? "Sending…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

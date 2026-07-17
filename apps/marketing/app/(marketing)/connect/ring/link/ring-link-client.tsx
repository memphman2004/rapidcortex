"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { demoJurisdictionSlug } from "@/lib/deployment-environment";
import { marketingLoginPath, marketingSignupPath } from "@/lib/marketing-links";

type LinkAudience = "citizen" | "agency";

type StatusMessage = {
  tone: "ok" | "err" | "neutral";
  title: string;
  body: string;
};

const API_BASE = process.env.NEXT_PUBLIC_RING_PUBLIC_OAUTH_BASE ?? "";

function parseAudience(raw: string | null): LinkAudience {
  return raw?.trim().toLowerCase() === "citizen" ? "citizen" : "agency";
}

function statusMessage(
  status: string | null,
  audience: LinkAudience,
  _deviceCount: number | null,
): StatusMessage {
  if (audience === "citizen") {
    if (status === "success" || status === "connected") {
      return {
        tone: "ok",
        title: "You're connected",
        body: "Thanks for enabling Rapid Cortex Connect. Dispatchers at participating agencies can request video only for qualifying incidents near your address — and only when you tap Allow on each SMS request.",
      };
    }
    if (status === "error") {
      return {
        tone: "err",
        title: "Complete setup in the Ring app",
        body: "Ring Device Owners enroll in the Ring Appstore (Ring → Appstore → Rapid Cortex Connect → Get App). If Ring shows Pending — App sign-in required, use Sign in on this site with your device-owner email and password — not dispatcher login.",
      };
    }
    return {
      tone: "neutral",
      title: "Rapid Cortex Connect · Ring",
      body: "Enable Rapid Cortex Connect in the Ring Appstore to participate. Every camera request requires your individual approval by SMS (Allow or Decline).",
    };
  }

  if (status === "success" || status === "connected") {
    return {
      tone: "ok",
      title: "Ring account linked",
      body: "Your Ring devices are connected to Rapid Cortex Connect. Sign in to manage cameras from the dispatcher Media workspace.",
    };
  }
  if (status === "error") {
    return {
      tone: "err",
      title: "Ring connection failed",
      body: "We could not complete the Ring authorization. Sign in and try Connect Ring Account again from Media.",
    };
  }
  return {
    tone: "neutral",
    title: "Rapid Cortex Connect · Ring",
    body: "Link your Ring account from the Rapid Cortex app, then return here after authorization completes.",
  };
}

function HomeownerAppstoreSignIn({ nonce, time }: { nonce: string; time: string }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "forgotConfirm">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState<{ deviceCount: number } | null>(null);

  function switchMode(next: "signin" | "signup" | "forgot" | "forgotConfirm") {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword("");
    setCode("");
    setNewPassword("");
    setNewPasswordConfirm("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!API_BASE) {
      setError("Connect API is not configured. Contact support.");
      return;
    }
    const api = API_BASE.replace(/\/$/, "");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const res = await fetch(`${api}/api/public/ring/homeowner/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          message?: string;
        };
        if (!res.ok || data.success === false) {
          setError(data.error || "Unable to start password reset.");
          return;
        }
        setInfo(data.message || "If an account exists for this email, we sent a verification code.");
        setMode("forgotConfirm");
        return;
      }

      if (mode === "forgotConfirm") {
        if (newPassword !== newPasswordConfirm) {
          setError("Passwords do not match.");
          return;
        }
        const res = await fetch(`${api}/api/public/ring/homeowner/confirm-forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email, code, newPassword }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          message?: string;
        };
        if (!res.ok || !data.success) {
          setError(data.error || "Unable to reset password.");
          return;
        }
        setPassword("");
        setCode("");
        setNewPassword("");
        setNewPasswordConfirm("");
        setInfo(data.message || "Password reset successfully. Sign in to finish linking.");
        setMode("signin");
        return;
      }

      const res = await fetch(`${api}/api/public/ring/homeowner/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password, mode, nonce, time }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: { deviceCount?: number };
      };
      if (!res.ok || !data.success) {
        setError(data.error || "Unable to complete linking.");
        return;
      }
      setDone({ deviceCount: data.data?.deviceCount ?? 0 });
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-6">
        <h2 className="text-lg font-semibold text-emerald-200">Connected</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Your Rapid Cortex account is linked to Ring
          {done.deviceCount > 0
            ? ` (${done.deviceCount} camera${done.deviceCount === 1 ? "" : "s"} registered).`
            : "."}{" "}
          Return to the Ring app — status should show Connected instead of Pending.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          You can close this window. Dispatchers may request video only for nearby emergencies, and
          only after you tap Allow on each SMS. You can Decline or Stop Sharing anytime.
        </p>
      </div>
    );
  }

  const isForgot = mode === "forgot" || mode === "forgotConfirm";

  return (
    <div className="mt-8">
      <p className="text-sm leading-relaxed text-slate-300">
        {isForgot
          ? "Reset your Rapid Cortex device-owner password. This is not your Ring account password."
          : "Sign in with a Rapid Cortex device-owner account to finish linking. This is not dispatcher login."}
      </p>
      {!isForgot ? (
        <div className="mt-5 flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              mode === "signin"
                ? "bg-sky-600 text-white"
                : "border border-slate-600 text-slate-300 hover:border-slate-500"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              mode === "signup"
                ? "bg-sky-600 text-white"
                : "border border-slate-600 text-slate-300 hover:border-slate-500"
            }`}
          >
            Create account
          </button>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
          />
        </label>

        {mode === "signin" || mode === "signup" ? (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Password</span>
            <input
              type="password"
              required
              minLength={12}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
            />
            {mode === "signup" ? (
              <span className="mt-1 block text-xs text-slate-500">
                At least 12 characters with upper, lower, number, and symbol.
              </span>
            ) : null}
          </label>
        ) : null}

        {mode === "forgotConfirm" ? (
          <>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Verification code
              </span>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                New password
              </span>
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
              />
              <span className="mt-1 block text-xs text-slate-500">
                At least 12 characters with upper, lower, number, and symbol.
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Confirm new password
              </span>
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
              />
            </label>
          </>
        ) : null}

        {info ? <p className="text-sm text-sky-300">{info}</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {busy
            ? "Working…"
            : mode === "forgot"
              ? "Send reset code"
              : mode === "forgotConfirm"
                ? "Reset password"
                : mode === "signup"
                  ? "Create account & connect"
                  : "Sign in & connect"}
        </button>
      </form>

      {mode === "signin" ? (
        <p className="mt-3 text-sm">
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            className="font-medium text-sky-400 hover:text-sky-300"
          >
            Forgot password?
          </button>
        </p>
      ) : null}

      {isForgot ? (
        <p className="mt-3 text-sm">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="font-medium text-sky-400 hover:text-sky-300"
          >
            Back to sign in
          </button>
        </p>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Link expires about 10 minutes after Ring redirects you here. If it expires, reopen Sign in
        from the Ring app.
      </p>
    </div>
  );
}

function CitizenLinkActions({ status }: { status: string | null }) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link
        href="/connect/ring/start"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
      >
        Ring Connect home
      </Link>
      <a
        href="mailto:support@rapidcortex.us?subject=Ring%20Connect%20device%20owner%20help"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
      >
        Contact support
      </a>
      <Link
        href="/legal/privacy/"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
      >
        Privacy policy
      </Link>
      {status === "error" ? (
        <p className="w-full text-xs text-slate-500">
          In the Ring app: Appstore → search Rapid Cortex Connect → Get App. If Pending,
          return here from Sign in in Ring.
        </p>
      ) : null}
    </div>
  );
}

function AgencyLinkActions() {
  const jurisdiction = demoJurisdictionSlug();
  const loginHref = marketingLoginPath();
  const signupHref = marketingSignupPath();
  const mediaHref = `https://app.rapidcortex.us/${jurisdiction}/media`;

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={loginHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
        >
          Sign in to Rapid Cortex
        </Link>
        <Link
          href={signupHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sky-500/60 px-5 text-sm font-semibold text-sky-300 hover:border-sky-400 hover:text-sky-200"
        >
          Sign up
        </Link>
        <Link
          href={mediaHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
        >
          Open Media workspace
        </Link>
      </div>

      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">New to Rapid Cortex?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Rapid Cortex is available to licensed emergency communications centers, campus safety
          departments, and venue security operations.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={signupHref}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
          >
            Sign up for Rapid Cortex
          </Link>
          <Link
            href="https://www.rapidcortex.us/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
          >
            Request Access
          </Link>
        </div>
      </section>
    </>
  );
}

export function RingLinkClient() {
  const searchParams = useSearchParams();
  const nonce = searchParams.get("nonce")?.trim() ?? "";
  const time = searchParams.get("time")?.trim() ?? "";
  const isAppstoreLink = Boolean(nonce && time);

  const status = searchParams.get("status");
  const audience = parseAudience(searchParams.get("audience"));
  const devicesRaw = searchParams.get("devices");
  const deviceCount =
    devicesRaw != null && devicesRaw !== "" && Number.isFinite(Number(devicesRaw))
      ? Number(devicesRaw)
      : null;
  const msg = useMemo(
    () => statusMessage(status, audience, deviceCount),
    [status, audience, deviceCount],
  );

  if (isAppstoreLink) {
    return (
      <article className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
          Ring Device Owners
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
          Sign in to finish connecting
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          Ring requires Rapid Cortex sign-in so we can securely claim your camera link. After you
          sign in, Ring will show Connected.
        </p>
        <HomeownerAppstoreSignIn nonce={nonce} time={time} />
        <div className="mt-10 space-y-2 border-t border-slate-800 pt-6 text-xs text-slate-500">
          <p>
            Dispatch center staff should use{" "}
            <Link href={marketingLoginPath()} className="text-sky-400 hover:text-sky-300">
              agency sign-in
            </Link>
            , not this page.
          </p>
          <p>
            Need help?{" "}
            <a href="mailto:support@rapidcortex.us" className="text-sky-400 hover:text-sky-300">
              support@rapidcortex.us
            </a>
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
        {audience === "citizen" ? "Ring Device Owners" : "Rapid Cortex Connect"}
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{msg.title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">{msg.body}</p>

      {audience === "citizen" ? (
        <CitizenLinkActions status={status} />
      ) : (
        <AgencyLinkActions />
      )}

      <div className="mt-10 space-y-2 border-t border-slate-800 pt-6 text-xs text-slate-500">
        {audience === "citizen" ? (
          <p>
            Dispatch center staff should use{" "}
            <Link href={marketingLoginPath()} className="text-sky-400 hover:text-sky-300">
              agency sign-in
            </Link>
            , not this page.
          </p>
        ) : null}
        <p>
          Need help?{" "}
          <Link href="/contact" className="text-sky-400 hover:text-sky-300">
            Contact support
          </Link>{" "}
          or email{" "}
          <a href="mailto:support@rapidcortex.us" className="text-sky-400 hover:text-sky-300">
            support@rapidcortex.us
          </a>
          .
        </p>
      </div>
    </article>
  );
}

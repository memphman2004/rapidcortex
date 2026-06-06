"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COGNITO_PASSWORD_REQUIREMENTS } from "@/lib/auth/cognito-password-policy";
import { isAuthConfigured } from "@/lib/auth/roles";
import { ensureCsrfCookie, jsonHeadersWithCsrf } from "@/lib/csrf-client";
import { marketingContactPath, marketingLoginPath, marketingPricingPath } from "@/lib/marketing-links";

export function SignupForm() {
  const router = useRouter();
  const loginHref = marketingLoginPath();
  const pricingHref = marketingPricingPath();
  const contactHref = marketingContactPath();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"register" | "confirm">("register");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendingCode, setResendingCode] = useState(false);

  if (!isAuthConfigured()) {
    return (
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
        Self-service sign-up is not enabled on this deployment. Ask your agency administrator to create your account, or{" "}
        <Link href={contactHref} className="font-medium text-amber-100 underline hover:text-white">
          contact us
        </Link>{" "}
        for provisioning support.
      </div>
    );
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: jsonHeadersWithCsrf(),
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        needsConfirmation?: boolean;
        destination?: string | null;
        error?: string;
      } | null;
      if (!res.ok) {
        setError(body?.error ?? "Could not create account");
        return;
      }
      if (body?.needsConfirmation) {
        setPhase("confirm");
        setCodeHint(
          body.destination
            ? `We sent a code to ${body.destination}.`
            : "Check your email for a confirmation code.",
        );
        return;
      }
      router.push(`${loginHref}?from=/signup&verified=1`);
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/auth/confirm-signup", {
        method: "POST",
        headers: jsonHeadersWithCsrf(),
        credentials: "include",
        body: JSON.stringify({ email, code }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "Invalid or expired code");
        return;
      }
      router.push(`${loginHref}?from=/signup&confirmed=1`);
    } finally {
      setSubmitting(false);
    }
  }

  async function onResendCode() {
    setError(null);
    setResendNotice(null);
    setResendingCode(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/auth/resend-signup-code", {
        method: "POST",
        headers: jsonHeadersWithCsrf(),
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => null)) as {
        destination?: string | null;
        error?: string;
      } | null;
      if (!res.ok) {
        setError(body?.error ?? "Could not resend confirmation code");
        return;
      }
      setResendNotice(
        body?.destination
          ? `A new code was sent to ${body.destination}.`
          : "A new confirmation code was sent.",
      );
    } finally {
      setResendingCode(false);
    }
  }

  if (phase === "confirm") {
    return (
      <form className="flex flex-col gap-4" onSubmit={onConfirm}>
        <p className="text-sm text-slate-400">{codeHint}</p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            readOnly
            value={email}
            className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-400 outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Confirmation code</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
          />
        </label>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        {resendNotice ? <p className="text-sm text-emerald-400">{resendNotice}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {submitting ? "Verifying…" : "Verify email"}
        </button>
        <button
          type="button"
          disabled={resendingCode}
          className="text-xs text-sky-400 underline hover:text-sky-300 disabled:opacity-50"
          onClick={onResendCode}
        >
          {resendingCode ? "Resending…" : "Resend code"}
        </button>
        <button
          type="button"
          className="text-xs text-slate-500 underline hover:text-slate-300"
          onClick={() => {
            setPhase("register");
            setCode("");
            setError(null);
            setResendNotice(null);
          }}
        >
          Back
        </button>
        <p className="text-center text-xs text-slate-500">
          <Link href={pricingHref} className="text-sky-400 hover:text-sky-300">
            Plans
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onRegister}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-300">Work email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-300">Password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
        />
      </label>
      <p className="text-[11px] leading-relaxed text-slate-500">{COGNITO_PASSWORD_REQUIREMENTS}</p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        After email verification, you can complete first sign-in with a provisional organization marker. Your administrator
        aligns your profile with the approved agency program during onboarding.
      </p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        <span className="font-medium text-slate-400">Security:</span> production pools require{" "}
        <span className="font-medium text-slate-400">TOTP authenticator (MFA)</span> on first
        sign-in. Have an app such as Google Authenticator or 1Password ready before you log in.
      </p>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {submitting ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-xs text-slate-500">
        Already have an account?{" "}
        <Link href={loginHref} className="text-sky-400 hover:text-sky-300">
          Sign in
        </Link>
        {" · "}
        <Link href={pricingHref} className="text-sky-400 hover:text-sky-300">
          Plans
        </Link>
      </p>
    </form>
  );
}

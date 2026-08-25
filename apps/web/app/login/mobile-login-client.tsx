"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jsonHeadersWithCsrf } from "@/lib/csrf-client";

export function MobileLoginClient({
  from,
  error,
}: {
  from?: string;
  error?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(error ?? "");

  async function submit() {
    setBusy(true);
    setLocalError("");
    try {
      const url = from ? `/api/auth/signin?next=${encodeURIComponent(from)}` : "/api/auth/signin";
      const res = await fetch(url, {
        method: "POST",
        headers: jsonHeadersWithCsrf(),
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
      if (body.error === "desktop-required" || body.redirectTo?.includes("desktop-required")) {
        router.push("/login?error=desktop-required");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Sign-in failed");
      router.push(body.redirectTo || from || "/app/venue");
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error === "desktop-required") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <p className="text-lg font-semibold">Desktop required</p>
        <p className="mt-2 text-sm text-slate-400">
          This role must sign in on a desktop workstation.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-slate-950 px-5 pt-12 text-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <h1 className="text-xl font-semibold">Campus / venue login</h1>
      <p className="mt-1 text-sm text-slate-400">Staff only — not for 911 dispatch.</p>
      {localError ? <p className="mt-3 text-sm text-rose-400">{localError}</p> : null}
      <label className="mt-6 text-xs text-slate-400">
        Email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 min-h-[52px] w-full rounded-xl border border-white/10 bg-transparent px-3 text-base text-white"
          style={{ fontSize: 16 }}
        />
      </label>
      <label className="mt-4 text-xs text-slate-400">
        Password
        <div className="mt-1 flex gap-2">
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="min-h-[52px] flex-1 rounded-xl border border-white/10 bg-transparent px-3 text-base text-white"
            style={{ fontSize: 16 }}
          />
          <button
            type="button"
            className="min-h-[52px] rounded-xl border border-white/10 px-3 text-xs"
            onClick={() => setShow((s) => !s)}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-6 min-h-[52px] rounded-xl bg-orange-600 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </div>
  );
}

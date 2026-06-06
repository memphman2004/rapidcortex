"use client";

import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { signOutFromClient } from "@/lib/auth/sign-out-client";
import { marketingLoginPath } from "@/lib/marketing-links";

const WARNING_MS = 2 * 60 * 1000;

function idleLimitMsForRole(role: string): number {
  if (isRcInternalOperator(role)) return 15 * 60 * 1000;
  return 30 * 60 * 1000;
}

function ensureWarningLayer(): HTMLDivElement {
  const existing = document.getElementById("rc-session-timeout-warning");
  if (existing instanceof HTMLDivElement) return existing;

  const root = document.createElement("div");
  root.id = "rc-session-timeout-warning";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "rc-session-timeout-warning-title");
  root.className =
    "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 text-slate-100";
  root.style.display = "none";
  root.innerHTML = `
    <div class="max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
      <h2 id="rc-session-timeout-warning-title" class="text-lg font-semibold">Signing out soon</h2>
      <p class="mt-2 text-sm text-slate-300">You will be signed out for inactivity in about two minutes unless you continue working.</p>
      <button type="button" id="rc-session-timeout-stay" class="mt-6 w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500">
        Stay signed in
      </button>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

/**
 * Client-side inactivity timeout.
 * - Dispatchers, analysts, auditors, supervisors, agencyadmin, agencyit: 30 minutes
 * - rcsuperadmin, rcadmin, rcitadmin: 15 minutes
 *
 * Shows a two-minute warning modal, then signs out via {@link signOutFromClient} to `/login`.
 */
export function initSessionTimeout(role: string): () => void {
  if (typeof window === "undefined") return () => {};

  const limitMs = idleLimitMsForRole(role);
  let lastActivity = Date.now();
  let warningShown = false;
  let timeoutId: number | undefined;
  let intervalId: number | undefined;

  const bump = () => {
    lastActivity = Date.now();
    if (warningShown) {
      warningShown = false;
      const layer = document.getElementById("rc-session-timeout-warning");
      if (layer instanceof HTMLElement) layer.style.display = "none";
    }
    schedule();
  };

  const events = ["mousemove", "mousedown", "keydown", "touchstart"] as const;
  for (const ev of events) {
    window.addEventListener(ev, bump, { passive: true });
  }

  const signOutIdle = () => {
    void signOutFromClient({ redirectTo: marketingLoginPath() });
  };

  const schedule = () => {
    window.clearTimeout(timeoutId);
    window.clearInterval(intervalId);
    const elapsed = () => Date.now() - lastActivity;
    const msUntilWarning = Math.max(0, limitMs - WARNING_MS - elapsed());
    timeoutId = window.setTimeout(() => {
      warningShown = true;
      const layer = ensureWarningLayer();
      layer.style.display = "flex";
      const btn = layer.querySelector("#rc-session-timeout-stay");
      if (btn instanceof HTMLButtonElement) {
        btn.onclick = () => bump();
      }
      intervalId = window.setInterval(() => {
        if (Date.now() - lastActivity >= limitMs) {
          window.clearInterval(intervalId);
          signOutIdle();
        }
      }, 1000);
    }, msUntilWarning);
  };

  schedule();

  return () => {
    window.clearTimeout(timeoutId);
    window.clearInterval(intervalId);
    for (const ev of events) {
      window.removeEventListener(ev, bump);
    }
    const layer = document.getElementById("rc-session-timeout-warning");
    layer?.remove();
  };
}

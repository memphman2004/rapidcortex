"use client";

import { useState } from "react";

export function PushNotificationRegister() {
  const [status, setStatus] = useState<"idle" | "ok" | "denied">("idle");

  async function enable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("denied");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setStatus("denied");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    let endpoint: string | undefined;
    let keys: { p256dh: string; auth: string } | undefined;

    if (registration && vapid && "PushManager" in window) {
      try {
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapid,
        });
        const json = sub.toJSON();
        endpoint = json.endpoint;
        if (json.keys?.p256dh && json.keys.auth) {
          keys = { p256dh: json.keys.p256dh, auth: json.keys.auth };
        }
      } catch {
        /* persist enablement even if VAPID subscribe fails */
      }
    }

    const res = await fetch("/api/venue/push-subscription", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        endpoint,
        keys,
        userAgent: navigator.userAgent,
      }),
    });
    setStatus(res.ok ? "ok" : "denied");
  }

  if (status === "ok") {
    return <p className="mb-3 text-xs text-emerald-400">Push alerts enabled.</p>;
  }

  return (
    <button
      type="button"
      onClick={() => void enable()}
      className="mb-3 min-h-[52px] w-full rounded-xl border border-amber-500/40 bg-amber-950/40 text-sm text-amber-200"
    >
      Enable push alerts
    </button>
  );
}

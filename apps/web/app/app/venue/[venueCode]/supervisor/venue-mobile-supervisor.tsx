"use client";

import { useState } from "react";
import { EscalateTo911Modal } from "@/components/venue/escalate-to-911-modal";
import { PushNotificationRegister } from "@/components/venue/push-notification-register";

export function VenueMobileSupervisor({ venueCode }: { venueCode: string }) {
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [sheet, setSheet] = useState<"none" | "notify" | "broadcast">("none");

  return (
    <div
      className="flex flex-col bg-slate-950 text-white"
      style={{
        minHeight: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <header className="border-b border-white/10 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Venue supervisor</p>
        <h1 className="text-lg font-semibold">{venueCode}</h1>
      </header>

      <main className="flex-1 overflow-auto px-4 py-4">
        <PushNotificationRegister />
        <p className="text-sm text-slate-400">Active incidents load from the venue console APIs.</p>
        <button
          type="button"
          className="mt-4 min-h-[52px] w-full rounded-xl bg-rose-700 text-sm font-semibold"
          onClick={() => setEscalateOpen(true)}
        >
          Escalate to 911
        </button>
      </main>

      <nav
        className="grid grid-cols-2 gap-2 border-t border-white/10 px-4 py-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          className="min-h-[52px] rounded-xl bg-white/10 text-sm font-medium"
          onClick={() => setSheet("notify")}
        >
          Notify Staff
        </button>
        <button
          type="button"
          className="min-h-[52px] rounded-xl bg-rose-800 text-sm font-semibold"
          onClick={() => setSheet("broadcast")}
        >
          Broadcast
        </button>
      </nav>

      {sheet !== "none" ? (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setSheet("none")}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-slate-900 p-4"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">
              {sheet === "broadcast" ? "Emergency broadcast" : "Notify staff"}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {sheet === "broadcast"
                ? "Sends SMS to staff with registered phones."
                : "Pushes an in-app alert to on-duty staff."}
            </p>
            <button
              type="button"
              className="mt-4 min-h-[52px] w-full rounded-xl bg-white/10 text-sm"
              onClick={() => setSheet("none")}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {escalateOpen ? (
        <EscalateTo911Modal
          incidentId={`venue-${venueCode}-manual`}
          incidentType="Security emergency"
          locationDescription={venueCode}
          onClose={() => setEscalateOpen(false)}
        />
      ) : null}
    </div>
  );
}

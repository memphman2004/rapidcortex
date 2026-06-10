"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Camera, Link2 } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { RingConnectButton, isRingEnabled } from "@/src/features/connect/ring";
import type { RingDevicesResponse } from "@/src/features/connect/ring/ring-types";

async function fetchRingDevices(): Promise<RingDevicesResponse> {
  const res = await fetch("/api/integrations/ring/devices", { credentials: "include" });
  if (res.status === 404) {
    return { success: true, data: { devices: [] } };
  }
  return (await res.json()) as RingDevicesResponse;
}

export function VenueCamerasClient({ venueCode }: { venueCode: string }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const ringEnabled = isRingEnabled();

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    const status = qp.get("status");
    if (status === "success" || status === "connected") {
      void queryClient.invalidateQueries({ queryKey: ["ring-devices", venueCode] });
      qp.delete("status");
      const next = `${window.location.pathname}${qp.toString() ? `?${qp.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, [queryClient, venueCode]);

  const devicesQuery = useQuery({
    queryKey: ["ring-devices", venueCode],
    enabled: ringEnabled && Boolean(user),
    queryFn: fetchRingDevices,
    refetchInterval: 30_000,
  });

  const devices = devicesQuery.data?.data?.devices ?? [];
  const linked = devices.length > 0;

  if (!ringEnabled) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-6 text-sm text-slate-300">
        Ring Connect is not enabled in this environment.
      </div>
    );
  }

  if (!user) {
    return <p className="text-sm text-slate-400">Sign in to manage venue cameras.</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cameras</h1>
        <p className="mt-1 text-sm text-slate-400">
          Link your Ring account and request live video from active incidents.
        </p>
      </div>

      <RingConnectButton
        agencyId={user.agencyId}
        userId={user.userId}
        onLinked={() => void queryClient.invalidateQueries({ queryKey: ["ring-devices", venueCode] })}
      />

      {linked ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((device) => (
            <article
              key={device.deviceId}
              className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-100">{device.deviceName}</h2>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${device.isEnabledForConnect ? "bg-green-400" : "bg-slate-500"}`}
                />
              </div>
              <div className="mt-3 flex aspect-video flex-col items-center justify-center rounded-md border border-slate-700 bg-slate-800/70 text-center">
                <Camera className="mb-1 h-6 w-6 text-sky-400" />
                <p className="text-xs text-slate-300">{device.deviceType}</p>
                {device.locationLabel ? (
                  <p className="mt-1 text-xs text-slate-400">{device.locationLabel}</p>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  {device.isEnabledForConnect ? "Ready for emergency requests" : "Disabled for Connect"}
                </p>
                <a
                  href={`/app/venue/${venueCode}/incidents`}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:bg-slate-800"
                >
                  <Link2 className="h-3 w-3" />
                  Incident Media
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
          <Camera className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-300">No Ring cameras linked yet.</p>
          <p className="mt-1 text-xs text-slate-500">Use Connect Ring Account above to authorize your devices.</p>
        </div>
      )}

    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Camera } from "lucide-react";
import { FIXTURE_CAMERAS, FIXTURE_ZONES } from "../_lib/venue-fixtures";
import type { VenueCamera } from "../_lib/venue-types";

type CameraFilter = "all" | VenueCamera["status"];

export default function VenueCamerasPage() {
  const [statusFilter, setStatusFilter] = useState<CameraFilter>("all");

  const onlineCount = FIXTURE_CAMERAS.filter((camera) => camera.status === "online").length;
  const offlineCount = FIXTURE_CAMERAS.filter((camera) => camera.status === "offline").length;
  const degradedCount = FIXTURE_CAMERAS.filter((camera) => camera.status === "degraded").length;

  const filteredCameras = useMemo(
    () => FIXTURE_CAMERAS.filter((camera) => (statusFilter === "all" ? true : camera.status === statusFilter)),
    [statusFilter],
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cameras</h1>
        <p className="mt-1 text-sm text-slate-400">Camera feeds linked to venue zones.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{onlineCount}</p>
          <p className="text-sm text-slate-400">Online</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{offlineCount}</p>
          <p className="text-sm text-slate-400">Offline</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{degradedCount}</p>
          <p className="text-sm text-slate-400">Degraded</p>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {(["all", "online", "offline", "degraded"] as CameraFilter[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              statusFilter === status
                ? "border-sky-400 bg-sky-500/20 text-sky-200"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {status}
          </button>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCameras.map((camera) => {
          const zoneLabel = FIXTURE_ZONES.find((zone) => zone.code === camera.zoneCode)?.label ?? camera.zoneCode;
          const statusDotClass =
            camera.status === "online"
              ? "bg-green-400"
              : camera.status === "offline"
                ? "bg-red-400"
                : "bg-amber-400";

          return (
            <article key={camera.id} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-100">{camera.name}</h2>
                <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
              </div>

              <div className="mt-3 flex aspect-video flex-col items-center justify-center rounded-md border border-slate-700 bg-slate-800/70 text-center">
                {camera.status === "online" ? (
                  <>
                    <Camera className="mb-1 h-6 w-6 text-sky-400" />
                    <p className="text-xs text-slate-300">Stream available</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle
                      className={`mb-1 h-6 w-6 ${camera.status === "offline" ? "text-red-400" : "text-amber-400"}`}
                    />
                    <p className="text-xs text-slate-300">
                      {camera.status === "offline" ? "Camera offline" : "Signal degraded"}
                    </p>
                  </>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400">{zoneLabel}</p>
                <button
                  type="button"
                  onClick={() => console.log("TODO: open KVS stream", camera.id)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  View Stream
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <p className="text-xs text-slate-500">
        Rapid Cortex references existing camera systems. It does not replace your camera infrastructure.
      </p>
    </div>
  );
}

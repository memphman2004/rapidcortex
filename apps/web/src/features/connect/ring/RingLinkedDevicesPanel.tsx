"use client";

import { Bell, Camera, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isRingEnabled } from "./ring-feature-flags";
import type { RingDeviceListItem, RingDevicesResponse } from "./ring-types";

type Toast = { tone: "ok" | "err"; text: string } | null;

export function RingLinkedDevicesPanel({
  agencyId: _agencyId,
  userId: _userId,
  onClose,
}: {
  agencyId: string;
  userId: string;
  onClose?: () => void;
}) {
  const [devices, setDevices] = useState<RingDeviceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [accountError, setAccountError] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/ring/devices", { credentials: "include" });
      const body = (await res.json()) as RingDevicesResponse;
      const next = body.data?.devices ?? [];
      setDevices(next);
      setAccountError(!res.ok || !body.success);
    } catch {
      setDevices([]);
      setAccountError(true);
      setToast({ tone: "err", text: "Failed to load linked devices." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isRingEnabled()) return;
    void load();
  }, []);

  const toggle = async (device: RingDeviceListItem, next: boolean) => {
    setToggling((prev) => ({ ...prev, [device.deviceId]: true }));
    setDevices((prev) => prev.map((d) => (d.deviceId === device.deviceId ? { ...d, isEnabledForConnect: next } : d)));
    try {
      const res = await fetch(`/api/integrations/ring/devices/${device.deviceId}/toggle`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabledForConnect: next }),
      });
      if (!res.ok) throw new Error("toggle_failed");
    } catch {
      setDevices((prev) =>
        prev.map((d) => (d.deviceId === device.deviceId ? { ...d, isEnabledForConnect: !next } : d)),
      );
      setToast({ tone: "err", text: "Unable to update device setting." });
    } finally {
      setToggling((prev) => ({ ...prev, [device.deviceId]: false }));
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/integrations/ring/devices/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("refresh_failed");
      await load();
    } catch {
      await load();
      setToast({ tone: "err", text: "Refresh endpoint unavailable. Reloaded current device list." });
    } finally {
      setRefreshing(false);
    }
  };

  if (!isRingEnabled()) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-[#2A3A4A] bg-[#0A0F1E] p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#F0F4F8]">Linked Ring Devices</h3>
          <p className="mt-1 text-sm text-[#8B9CB0]">
            These devices are available for emergency collaboration when enabled.
          </p>
        </div>
        {onClose ? (
          <button type="button" className="rounded p-1 text-[#8B9CB0] hover:text-white" onClick={onClose}>
            <X size={18} />
          </button>
        ) : null}
      </div>

      {accountError ? (
        <div className="mt-3 rounded border border-amber-500/40 bg-amber-950/20 p-3 text-sm text-amber-200">
          Your Ring account needs to be reconnected. Some devices may not be available.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              window.location.href = "/api/backend/api/integrations/ring/login";
            }}
          >
            Reconnect →
          </button>
        </div>
      ) : null}

      {toast ? (
        <p className={`mt-3 text-sm ${toast.tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{toast.text}</p>
      ) : null}

      <div className="mt-4 space-y-2">
        {loading ? <p className="text-sm text-[#8B9CB0]">Loading devices...</p> : null}
        {!loading && devices.length === 0 ? (
          <p className="text-sm text-[#8B9CB0]">
            No Ring devices found. Make sure your Ring account is linked and has cameras.
          </p>
        ) : null}
        {devices.map((device) => (
          <div key={device.deviceId} className="rounded border border-[#2A3A4A] bg-[#1E2A3A] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm text-[#F0F4F8]">
                  {device.deviceType === "DOORBELL" ? <Bell size={14} /> : <Camera size={14} />}
                  <span>{device.deviceName}</span>
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200">
                    {device.deviceType}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8B9CB0]">{device.locationLabel || "No location label"}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#F0F4F8]">
                <span>Enabled for Connect</span>
                <input
                  type="checkbox"
                  checked={device.isEnabledForConnect}
                  disabled={Boolean(toggling[device.deviceId])}
                  onChange={(e) => void toggle(device, e.target.checked)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void refresh()}
        disabled={refreshing}
        className="mt-4 inline-flex items-center gap-2 rounded border border-[#2A3A4A] bg-[#1E2A3A] px-3 py-2 text-sm text-[#F0F4F8] hover:bg-[#243447] disabled:opacity-50"
      >
        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        Refresh Devices
      </button>
    </div>
  );
}

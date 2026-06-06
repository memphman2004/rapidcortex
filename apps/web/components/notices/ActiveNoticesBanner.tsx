"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Info, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlatformNotice } from "rapid-cortex-shared";
import {
  acknowledgePlatformNotice,
  fetchActivePlatformNotices,
} from "@/lib/platform-notices-api";

const DISMISSED_KEY = "rc-dismissed-notices-v1";
const ACKED_KEY = "rc-acked-notices-v1";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function readAcked(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(ACKED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeAcked(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACKED_KEY, JSON.stringify([...ids]));
}

function severityStyles(severity: PlatformNotice["severity"]) {
  if (severity === "critical") {
    return {
      bg: "bg-red-950/90 border-red-600/70 text-red-50",
      icon: AlertTriangle,
    };
  }
  if (severity === "warning") {
    return {
      bg: "bg-amber-950/80 border-amber-500/60 text-amber-50",
      icon: AlertTriangle,
    };
  }
  return {
    bg: "bg-sky-950/80 border-sky-500/50 text-sky-50",
    icon: Info,
  };
}

export function ActiveNoticesBanner() {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const [acked, setAcked] = useState<Set<string>>(() => readAcked());

  const noticesQuery = useQuery({
    queryKey: ["platform-notices-active"],
    queryFn: fetchActivePlatformNotices,
    refetchInterval: 60_000,
  });

  const ackMutation = useMutation({
    mutationFn: (noticeId: string) => acknowledgePlatformNotice(noticeId),
    onSuccess: (_data, noticeId) => {
      setAcked((prev) => {
        const next = new Set(prev);
        next.add(noticeId);
        writeAcked(next);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["platform-notices-active"] });
    },
  });

  const visibleNotices = useMemo(() => {
    const rows = noticesQuery.data ?? [];
    return rows.filter((n) => {
      if (n.requiresAck && acked.has(n.noticeId)) return false;
      if (n.requiresAck) return true;
      return !dismissed.has(n.noticeId);
    });
  }, [noticesQuery.data, dismissed, acked]);

  const blockingNotice = useMemo(
    () => visibleNotices.find((n) => n.requiresAck && n.severity === "critical") ?? null,
    [visibleNotices],
  );

  const dismiss = useCallback((noticeId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(noticeId);
      writeDismissed(next);
      return next;
    });
  }, []);

  useEffect(() => {
    writeDismissed(dismissed);
  }, [dismissed]);

  if (noticesQuery.isLoading || visibleNotices.length === 0) return null;

  return (
    <>
      <div className="space-y-2 border-b border-slate-800/80 px-4 py-2 md:px-6">
        {visibleNotices.map((notice) => {
          const styles = severityStyles(notice.severity);
          const Icon = styles.icon;
          const canDismiss = notice.dismissible && !notice.requiresAck;
          return (
            <div
              key={notice.noticeId}
              className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${styles.bg}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{notice.title}</p>
                <p className="mt-0.5 text-xs opacity-90">{notice.message}</p>
              </div>
              {canDismiss ? (
                <button
                  type="button"
                  aria-label="Dismiss notice"
                  onClick={() => dismiss(notice.noticeId)}
                  className="rounded p-1 opacity-80 hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {blockingNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-red-600 bg-red-950 p-6 text-red-50 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <h2 className="text-lg font-semibold">{blockingNotice.title}</h2>
                <p className="mt-2 text-sm opacity-90">{blockingNotice.message}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={ackMutation.isPending}
              onClick={() => void ackMutation.mutateAsync(blockingNotice.noticeId)}
              className="mt-6 w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {ackMutation.isPending ? "Recording…" : "I understand — continue"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

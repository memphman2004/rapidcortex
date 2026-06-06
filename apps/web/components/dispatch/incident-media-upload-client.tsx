"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PublicMeta = { status: string; expiresAt: string; consentVersion: string };

function publicApiBase(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
}

export function IncidentMediaUploadClient({ token }: { token: string }) {
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"loading" | "ready" | "done" | "error">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  const enc = useMemo(() => encodeURIComponent(token), [token]);

  const loadMeta = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch(`${publicApiBase()}/api/public/media/${enc}`);
      const text = await res.text();
      const body = text ? (JSON.parse(text) as unknown) : null;
      if (!res.ok) {
        setLoadErr(
          typeof body === "object" && body && "error" in body
            ? String((body as { error: string }).error)
            : res.statusText,
        );
        setStep("error");
        return;
      }
      setMeta(body as PublicMeta);
      setStep("ready");
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load");
      setStep("error");
    }
  }, [enc]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const onUpload = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const consentBody = {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        byteSize: file.size,
        consent: { acceptTerms: true as const, consentVersion: meta?.consentVersion ?? "v1" },
      };
      const urlRes = await fetch(`${publicApiBase()}/api/public/media/${enc}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(consentBody),
      });
      const urlText = await urlRes.text();
      const urlJson = urlText ? (JSON.parse(urlText) as Record<string, unknown>) : {};
      if (!urlRes.ok) {
        throw new Error(typeof urlJson.message === "string" ? urlJson.message : "Could not get upload URL");
      }
      const uploadUrl = urlJson.uploadUrl as string;
      const s3Key = urlJson.s3Key as string;
      const hdrs = (urlJson.headers as Record<string, string> | undefined) ?? {};
      const putHeaders = new Headers();
      putHeaders.set("Content-Type", hdrs["Content-Type"] ?? file.type ?? "application/octet-stream");
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: putHeaders });
      if (!put.ok) {
        throw new Error(`Upload to storage failed (${put.status})`);
      }
      const confirmRes = await fetch(`${publicApiBase()}/api/public/media/${enc}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          byteSize: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });
      const confirmText = await confirmRes.text();
      if (!confirmRes.ok) {
        const cj = confirmText ? (JSON.parse(confirmText) as { message?: string }) : {};
        throw new Error(cj.message ?? "Confirm failed");
      }
      setStep("done");
      setMsg("Upload complete. Responders can review this file on the incident.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
      setStep("error");
    } finally {
      setBusy(false);
    }
  };

  if (step === "loading") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-slate-300">
        <p className="text-sm">Checking your upload link…</p>
      </div>
    );
  }

  if (loadErr || !meta) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-rose-200">
        <h1 className="text-lg font-semibold">Link unavailable</h1>
        <p className="mt-2 text-sm text-rose-100/80">{loadErr ?? "Unknown error"}</p>
      </div>
    );
  }

  if (meta.status === "sms_failed") {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-amber-100">
        <h1 className="text-lg font-semibold">SMS could not be delivered</h1>
        <p className="mt-2 text-sm text-slate-300">Ask dispatch to resend the media request.</p>
      </div>
    );
  }

  if (meta.status === "uploaded" || step === "done") {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-emerald-100">
        <h1 className="text-lg font-semibold">Thank you</h1>
        <p className="mt-2 text-sm text-slate-300">{msg ?? "This link has already been used."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6 text-slate-100">
      <div>
        <h1 className="text-xl font-semibold text-white">Share photos or files</h1>
        <p className="mt-2 text-sm text-slate-400">
          One-time secure upload for emergency responders. Link expires {new Date(meta.expiresAt).toLocaleString()}.
        </p>
      </div>
      <label className="block text-sm">
        <span className="text-slate-400">Choose file (images, short video, PDF, audio)</span>
        <input
          type="file"
          disabled={busy}
          className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sky-200"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
      </label>
      {busy ? <p className="text-xs text-slate-500">Uploading…</p> : null}
      {msg && step === "error" ? <p className="text-sm text-rose-300">{msg}</p> : null}
      <p className="text-[11px] leading-relaxed text-slate-500">
        By uploading you confirm you have the right to share this material with the agency handling this incident (
        {meta.consentVersion}).
      </p>
    </div>
  );
}

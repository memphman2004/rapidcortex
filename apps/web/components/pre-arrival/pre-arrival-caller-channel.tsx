"use client";

import { useCallback, useEffect, useState } from "react";
import type { CallerChannelPublicItem } from "rapid-cortex-shared";

export function PreArrivalCallerChannel({ token }: { token: string }) {
  const [messages, setMessages] = useState<CallerChannelPublicItem[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/pre-arrival/${encodeURIComponent(token)}/channel`);
    if (!res.ok) return;
    const data = (await res.json()) as { messages?: CallerChannelPublicItem[] };
    setMessages(data.messages ?? []);
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  const sendText = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/pre-arrival/${encodeURIComponent(token)}/channel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "text", text: body }),
      });
      if (!res.ok) {
        setError("Message was not sent. Try again.");
        return;
      }
      setText("");
      await load();
    } catch {
      setError("Message was not sent. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      setError("This phone cannot share a location.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`/api/public/pre-arrival/${encodeURIComponent(token)}/channel`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              kind: "location",
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy,
            }),
          });
          if (!res.ok) setError("Location was not sent. Try again.");
          else await load();
        } catch {
          setError("Location was not sent. Try again.");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError("Location permission was not granted.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const sendFile = async (file: File, kind: "photo" | "video") => {
    setBusy(true);
    setError(null);
    try {
      const issued = await fetch(`/api/public/pre-arrival/${encodeURIComponent(token)}/channel/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          fileName: file.name || `${kind}.bin`,
          contentType: file.type,
          byteSize: file.size,
        }),
      });
      if (!issued.ok) {
        setError("That file could not be sent.");
        return;
      }
      const upload = (await issued.json()) as { messageId: string; uploadUrl: string };
      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) {
        setError("That file could not be sent.");
        return;
      }
      const confirmed = await fetch(`/api/public/pre-arrival/${encodeURIComponent(token)}/channel/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: upload.messageId }),
      });
      if (!confirmed.ok) {
        setError("That file could not be sent.");
        return;
      }
      await load();
    } catch {
      setError("That file could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Send an update</h2>
      <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto">
        {messages.map((message) => (
          <li
            key={message.messageId}
            className={`rounded px-2 py-1.5 text-sm ${
              message.from === "dispatcher" ? "bg-sky-950/60 text-sky-100" : "bg-slate-900 text-slate-100"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              {message.from === "dispatcher" ? "Dispatch" : "You"}
            </p>
            <p>{message.text ?? message.mediaLabel}</p>
          </li>
        ))}
      </ul>
      <textarea
        value={text}
        maxLength={500}
        rows={2}
        placeholder="Tell dispatch what is happening"
        onChange={(event) => setText(event.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void sendText()}
          className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void shareLocation()}
          className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
        >
          Share location
        </button>
        <label className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200">
          Photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void sendFile(file, "photo");
            }}
          />
        </label>
        <label className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200">
          Video
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void sendFile(file, "video");
            }}
          />
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

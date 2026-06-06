"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoAssistPublicSession } from "rapid-cortex-shared";

type LocaleKey = "en" | "es";

const STRINGS: Record<
  LocaleKey,
  {
    title: string;
    lead: string;
    bullets: string[];
    consentLabel: string;
    startVideo: string;
    startCameraOnly: string;
    switchCamera: string;
    photoInstead: string;
    endSharing: string;
    errorGeneric: string;
    sessionClosed: string;
    expired: string;
    micHint: string;
    trustFoot: string;
  }
> = {
  en: {
    title: "Caller Video Assist",
    lead:
      "Rapid Cortex has requested temporary live video to help emergency personnel assess the situation. This link works once and expires automatically.",
    bullets: [
      "No app install — your mobile browser only.",
      "You can stop sharing at any time.",
      "Use only if you feel safe to do so.",
    ],
    consentLabel: "I understand and agree to share my camera for this session.",
    startVideo: "Start video",
    startCameraOnly: "Start camera (no microphone)",
    switchCamera: "Switch camera",
    photoInstead: "Take a photo instead",
    endSharing: "End sharing",
    errorGeneric: "Something went wrong. You can try again or contact dispatch by voice.",
    sessionClosed: "This session has ended. If dispatch still needs help, they will contact you again.",
    expired: "This link has expired. Please ask dispatch to send a new link if video is still needed.",
    micHint: "Microphone is optional for this agency. Video is usually enough.",
    trustFoot: "If the page does not match what dispatch described, close it and call back on your usual emergency line.",
  },
  es: {
    title: "Asistencia de video para quien llama",
    lead:
      "Rapid Cortex solicita video en vivo temporal para ayudar al personal de emergencia a evaluar la situación. Este enlace es de un solo uso y caduca automáticamente.",
    bullets: [
      "Sin instalar aplicaciones: solo el navegador del teléfono.",
      "Puede dejar de compartir en cualquier momento.",
      "Úselo solo si se siente seguro.",
    ],
    consentLabel: "Entiendo y acepto compartir mi cámara para esta sesión.",
    startVideo: "Iniciar video",
    startCameraOnly: "Solo cámara (sin micrófono)",
    switchCamera: "Cambiar cámara",
    photoInstead: "Tomar una foto",
    endSharing: "Dejar de compartir",
    errorGeneric: "Algo salió mal. Puede intentar de nuevo o hablar con despacho por voz.",
    sessionClosed: "Esta sesión terminó. Si despacho aún necesita ayuda, le volverán a contactar.",
    expired: "Este enlace expiró. Pida a despacho un nuevo enlace si aún necesitan video.",
    micHint: "El micrófono es opcional para esta agencia. Normalmente basta con el video.",
    trustFoot:
      "Si esta página no coincide con lo que despacho describió, ciérrela y vuelva a llamar a su línea de emergencia habitual.",
  },
};

function publicPath(token: string, sub?: string) {
  const enc = encodeURIComponent(token);
  return sub ? `/api/public/video-assist/${enc}/${sub}` : `/api/public/video-assist/${enc}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error("empty");
  return JSON.parse(text) as T;
}

export function VideoAssistCallerClient({ token }: { token: string }) {
  const [locale, setLocale] = useState<LocaleKey>("en");
  const [session, setSession] = useState<VideoAssistPublicSession | null>(null);
  const sessionRef = useRef<VideoAssistPublicSession | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [localActive, setLocalActive] = useState(false);
  const facingRef = useRef<"user" | "environment">("environment");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dispatcherIceSeenRef = useRef(new Set<string>());
  const callerIcePostedRef = useRef(new Set<string>());
  const openedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const t = STRINGS[locale];

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const loadSession = useCallback(async () => {
    const res = await fetch(publicPath(token), { method: "GET", cache: "no-store" });
    if (res.status === 410) {
      setErrCode("expired");
      return null;
    }
    if (res.status === 409) {
      setErrCode("closed");
      return null;
    }
    if (!res.ok) {
      setErrCode("generic");
      return null;
    }
    const s = await readJson<VideoAssistPublicSession>(res);
    setSession(s);
    if (s.callerLocale === "es") setLocale("es");
    if (s.status === "ended" || s.status === "canceled") setEnded(true);
    return s;
  }, [token]);

  useEffect(() => {
    void loadSession().catch(() => setErrCode("generic"));
    const id = window.setInterval(() => {
      void loadSession().catch(() => {});
    }, 1800);
    return () => window.clearInterval(id);
  }, [loadSession]);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void fetch(publicPath(token, "opened"), { method: "POST" }).catch(() => {});
  }, [token]);

  const mergeDispatcherIce = useCallback((pc: RTCPeerConnection, candidates?: string[]) => {
    if (!candidates?.length) return;
    for (const json of candidates) {
      if (dispatcherIceSeenRef.current.has(json)) continue;
      dispatcherIceSeenRef.current.add(json);
      try {
        const init = JSON.parse(json) as RTCIceCandidateInit;
        if (!init?.candidate) continue;
        void pc.addIceCandidate(new RTCIceCandidate(init));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    const pc = pcRef.current;
    const answerSdp = session?.dispatcherAnswerSdp;
    if (!pc || !answerSdp) return;
    void (async () => {
      try {
        const cur = pc.remoteDescription?.sdp;
        if (cur !== answerSdp) {
          await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        }
        mergeDispatcherIce(pc, session.iceDispatcher);
      } catch {
        /* ignore */
      }
    })();
  }, [mergeDispatcherIce, session?.dispatcherAnswerSdp, session?.iceDispatcher]);

  const teardown = useCallback(async () => {
    setLocalActive(false);
    localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    dispatcherIceSeenRef.current.clear();
    callerIcePostedRef.current.clear();
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      await fetch(publicPath(token, "end"), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } catch {
      /* ignore */
    }
    setEnded(true);
  }, [token]);

  const start = useCallback(async () => {
    if (!consent) return;
    setBusy("start");
    setErrCode(null);
    try {
      await fetch(publicPath(token, "consent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acknowledged: true,
          client: { userAgent: navigator.userAgent, language: navigator.language },
        }),
      });
      const iceRes = await fetch(publicPath(token, "ice-config"), { cache: "no-store" });
      const icePayload = iceRes.ok ? await iceRes.json().catch(() => null) : null;
      const iceServers =
        icePayload &&
        typeof icePayload === "object" &&
        icePayload !== null &&
        "iceServers" in icePayload &&
        Array.isArray((icePayload as { iceServers: unknown }).iceServers)
          ? (icePayload as { iceServers: RTCIceServer[] }).iceServers
          : [{ urls: "stun:stun.l.google.com:19302" }];

      const allowMic = Boolean(sessionRef.current?.allowMicrophone);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current },
        audio: allowMic,
      });
      localStreamRef.current = stream;
      setLocalActive(true);
      const v = videoRef.current;
      if (v) v.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        const json = JSON.stringify(ev.candidate.toJSON());
        if (callerIcePostedRef.current.has(json)) return;
        callerIcePostedRef.current.add(json);
        void fetch(publicPath(token, "signal"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "ice-caller", candidate: json }),
        }).catch(() => {
          callerIcePostedRef.current.delete(json);
        });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch(publicPath(token, "signal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "caller-offer", sdp: offer.sdp! }),
      });
      void loadSession();
    } catch {
      setErrCode("generic");
    } finally {
      setBusy(null);
    }
  }, [consent, loadSession, token]);

  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    const pc = pcRef.current;
    if (!stream || !pc) return;
    facingRef.current = facingRef.current === "user" ? "environment" : "user";
    setBusy("switch");
    try {
      const vtrack = stream.getVideoTracks()[0];
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current },
        audio: false,
      });
      const newV = newStream.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && newV) await sender.replaceTrack(newV);
      if (vtrack) stream.removeTrack(vtrack);
      vtrack?.stop();
      stream.addTrack(newV);
      const vid = videoRef.current;
      if (vid) vid.srcObject = stream;
    } catch {
      setErrCode("generic");
    } finally {
      setBusy(null);
    }
  }, []);

  const photoFallback = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caller-photo-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    };
    input.click();
  }, []);

  if (ended) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-4 bg-slate-950 px-4 py-10 text-slate-100">
        <p className="text-center text-sm leading-relaxed text-slate-300">{t.sessionClosed}</p>
      </main>
    );
  }

  if (errCode === "expired") {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-4 bg-slate-950 px-4 py-10 text-slate-100">
        <p className="text-center text-sm leading-relaxed text-amber-100/90">{t.expired}</p>
      </main>
    );
  }

  if (errCode === "closed") {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-4 bg-slate-950 px-4 py-10 text-slate-100">
        <p className="text-center text-sm leading-relaxed text-slate-300">{t.sessionClosed}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-lg bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-8 text-slate-100">
      <header className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">Secure session</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">{t.title}</h1>
      </header>

      <div className="mt-2 flex justify-center gap-2 text-[11px]">
        <button
          type="button"
          className={`rounded-full px-3 py-1 ${locale === "en" ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400"}`}
          onClick={() => setLocale("en")}
        >
          English
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 ${locale === "es" ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400"}`}
          onClick={() => setLocale("es")}
        >
          Español
        </button>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-slate-300">{t.lead}</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-400">
        {t.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {session?.allowMicrophone ? <p className="mt-3 text-xs text-slate-500">{t.micHint}</p> : null}

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>{t.consentLabel}</span>
      </label>

      {errCode === "generic" ? (
        <p className="mt-4 rounded-md border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-100">{t.errorGeneric}</p>
      ) : null}

      <div className="mt-6 space-y-2">
        <button
          type="button"
          disabled={!consent || busy !== null}
          onClick={() => void start()}
          className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-500 disabled:opacity-40"
        >
          {busy === "start" ? "…" : session?.allowMicrophone ? t.startVideo : t.startCameraOnly}
        </button>
        <button
          type="button"
          disabled={!localActive || busy !== null}
          onClick={() => void switchCamera()}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          {busy === "switch" ? "…" : t.switchCamera}
        </button>
        <button
          type="button"
          onClick={photoFallback}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          {t.photoInstead}
        </button>
        <button
          type="button"
          onClick={() => void teardown()}
          className="w-full rounded-xl border border-rose-900/60 bg-rose-950/30 py-2.5 text-sm font-medium text-rose-100 hover:bg-rose-950/50"
        >
          {t.endSharing}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-black">
        <video ref={videoRef} playsInline autoPlay muted className="aspect-video w-full object-cover" />
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500">{t.trustFoot}</p>
    </main>
  );
}

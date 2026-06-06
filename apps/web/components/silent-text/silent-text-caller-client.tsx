"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SilentTextPublicSession } from "rapid-cortex-shared";
import { DEFAULT_CALLER_QUICK_REPLIES } from "rapid-cortex-shared";

type LocaleKey = "en" | "es";

const COPY: Record<
  LocaleKey,
  {
    title: string;
    subtitle: string;
    lead: string;
    end: string;
    quickExit: string;
    hide: string;
    show: string;
    stealthTitle: string;
    stealthHint: string;
    placeholder: string;
    send: string;
    ended: string;
    expired: string;
    closed: string;
    err: string;
  }
> = {
  en: {
    title: "Secure text with dispatch",
    subtitle: "Emergency services",
    lead: "If speaking is not safe, reply here by text. Short answers are OK — yes/no is fine.",
    end: "End session",
    quickExit: "Quick exit",
    hide: "Hide chat",
    show: "Show chat",
    stealthTitle: "Notes",
    stealthHint: "Discreet view — your messages still go to dispatch.",
    placeholder: "Type a short message…",
    send: "Send",
    ended: "This session has ended. You can close this tab.",
    expired: "This link has expired. If you still need help, call your local emergency number when it is safe.",
    closed: "This session is closed.",
    err: "Could not send. Check your connection and try again.",
  },
  es: {
    title: "Texto seguro con despacho",
    subtitle: "Servicios de emergencia",
    lead: "Si no es seguro hablar, responda aquí por texto. Respuestas cortas están bien.",
    end: "Terminar sesión",
    quickExit: "Salida rápida",
    hide: "Ocultar chat",
    show: "Mostrar chat",
    stealthTitle: "Notas",
    stealthHint: "Vista discreta — sus mensajes siguen llegando a despacho.",
    placeholder: "Escriba un mensaje breve…",
    send: "Enviar",
    ended: "Esta sesión terminó. Puede cerrar esta pestaña.",
    expired: "Este enlace expiró. Si aún necesita ayuda, llame al número de emergencia local cuando sea seguro.",
    closed: "Esta sesión está cerrada.",
    err: "No se pudo enviar. Compruebe la conexión e intente de nuevo.",
  },
};

function apiPath(token: string, sub?: string) {
  const enc = encodeURIComponent(token);
  return sub ? `/api/public/silent-text/${enc}/${sub}` : `/api/public/silent-text/${enc}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error("empty");
  return JSON.parse(text) as T;
}

export function SilentTextCallerClient({ token }: { token: string }) {
  const [locale, setLocale] = useState<LocaleKey>("en");
  const [session, setSession] = useState<SilentTextPublicSession | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const openedRef = useRef(false);
  const t = COPY[locale];

  const load = useCallback(async () => {
    const res = await fetch(apiPath(token), { cache: "no-store" });
    if (res.status === 410) {
      setCode("expired");
      return;
    }
    if (res.status === 409) {
      setCode("closed");
      return;
    }
    if (!res.ok) {
      setErr(t.err);
      return;
    }
    const s = await readJson<SilentTextPublicSession>(res);
    setSession(s);
    if (s.callerLocale === "es") setLocale("es");
    setErr(null);
    setCode(null);
  }, [t.err, token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 2200);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void fetch(apiPath(token, "opened"), { method: "POST" }).catch(() => {});
  }, [token]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetch(apiPath(token, "presence"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: "caller_web" }),
      }).catch(() => {});
    }, 50_000);
    return () => window.clearInterval(id);
  }, [token]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(apiPath(token, "message"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        if (!res.ok) {
          setErr(t.err);
          return;
        }
        setDraft("");
        await load();
      } catch {
        setErr(t.err);
      } finally {
        setBusy(false);
      }
    },
    [load, t.err, token],
  );

  const endSession = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(apiPath(token, "end"), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await load();
    } finally {
      setBusy(false);
    }
  }, [load, token]);

  const quickExit = useCallback(() => {
    window.location.replace("https://www.google.com");
  }, []);

  const stealth = Boolean(session?.stealthAppearance);
  const shellClass = stealth
    ? "min-h-[100dvh] bg-zinc-200 text-zinc-900"
    : "min-h-[100dvh] bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100";

  if (code === "expired") {
    return (
      <main className="mx-auto flex max-w-lg flex-col justify-center gap-4 px-4 py-16 text-center text-sm text-amber-100">
        {t.expired}
      </main>
    );
  }

  if (!session && !code) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-24 text-sm text-slate-400">
        Connecting…
      </main>
    );
  }

  if (code === "closed" || session?.status === "ended" || session?.status === "canceled") {
    return (
      <main className="mx-auto flex max-w-lg flex-col justify-center gap-4 px-4 py-16 text-center text-sm text-slate-300">
        {session?.status === "ended" ? t.ended : t.closed}
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className={`mx-auto max-w-lg ${shellClass}`}>
      <div className={stealth ? "px-3 py-3" : "px-4 py-6"}>
        <header className={hidden ? "sr-only" : ""}>
          <p
            className={`text-[10px] font-semibold uppercase tracking-widest ${
              stealth ? "text-zinc-600" : "text-sky-300/90"
            }`}
          >
            {stealth ? t.stealthHint : t.subtitle}
          </p>
          <h1 className={`mt-1 text-xl font-semibold ${stealth ? "text-zinc-800" : "text-white"}`}>
            {stealth ? t.stealthTitle : t.title}
          </h1>
          {!stealth ? (
            <div className="mt-2 flex gap-2 text-[11px]">
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${locale === "en" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400"}`}
                onClick={() => setLocale("en")}
              >
                English
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${locale === "es" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400"}`}
                onClick={() => setLocale("es")}
              >
                Español
              </button>
            </div>
          ) : null}
          <p className={`mt-4 text-sm leading-relaxed ${stealth ? "text-zinc-700" : "text-slate-300"}`}>{t.lead}</p>
        </header>

        {err ? (
          <p className="mt-3 rounded-md border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-100" role="alert">
            {err}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            className={`min-h-[44px] rounded-xl px-4 text-sm font-medium ${
              stealth ? "bg-zinc-300 text-zinc-900" : "border border-slate-700 bg-slate-900 text-slate-200"
            }`}
          >
            {hidden ? t.show : t.hide}
          </button>
          <button
            type="button"
            onClick={quickExit}
            className="min-h-[44px] rounded-xl bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-600"
          >
            {t.quickExit}
          </button>
        </div>

        {!hidden ? (
          <>
            <div
              className={`mt-4 max-h-[45vh] space-y-2 overflow-y-auto rounded-xl border p-3 ${
                stealth ? "border-zinc-300 bg-white" : "border-slate-800 bg-slate-900/50"
              }`}
            >
              {(session?.messages ?? []).map((m) => (
                <div
                  key={m.messageId}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.from === "dispatcher"
                      ? stealth
                        ? "ml-6 bg-zinc-100 text-zinc-900"
                        : "ml-6 bg-violet-950/50 text-violet-100"
                      : stealth
                        ? "mr-6 bg-zinc-200 text-zinc-900"
                        : "mr-6 bg-slate-800 text-slate-100"
                  }`}
                >
                  <span className="text-[10px] uppercase opacity-60">{m.from}</span>
                  <p className="mt-1 whitespace-pre-wrap leading-snug">{m.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEFAULT_CALLER_QUICK_REPLIES.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendText(q.text)}
                  className={`min-h-[48px] rounded-xl px-2 text-sm font-medium ${
                    stealth ? "bg-zinc-300 text-zinc-900 hover:bg-zinc-400" : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                  } disabled:opacity-40`}
                >
                  {q.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.placeholder}
                className={`min-h-[48px] min-w-0 flex-1 rounded-xl border px-3 text-base ${
                  stealth ? "border-zinc-400 bg-white text-zinc-900" : "border-slate-700 bg-slate-950 text-slate-100"
                }`}
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void sendText(draft)}
                className="min-h-[48px] shrink-0 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
              >
                {busy ? "…" : t.send}
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void endSession()}
              className="mt-4 w-full min-h-[48px] rounded-xl border border-rose-900/60 bg-rose-950/40 text-sm font-semibold text-rose-100 hover:bg-rose-950/60"
            >
              {t.end}
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}

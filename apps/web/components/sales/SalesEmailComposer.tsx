"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SALES_EMAIL_POLISH_MIN_BODY,
  type SalesEmailPolishResult,
} from "rapid-cortex-shared";

type TemplateId = "intro" | "follow-up" | "proposal" | "blank";
type PolishTone = "professional" | "warm" | "concise";

type OutlookStatus = {
  configured: boolean;
  mock: boolean;
  connected: boolean;
  mailbox?: string;
  requiredDomain?: string;
};

const TEMPLATES: Record<
  TemplateId,
  { label: string; subject: string; body: string }
> = {
  intro: {
    label: "Intro",
    subject: "NexCort iQ — quick intro for your {{agency}} team",
    body: `Hi {{name}},

I work with public-safety and campus teams on NexCort iQ — real-time AI that supports dispatchers without replacing CAD or medical direction.

Would a 20-minute walkthrough with your ops lead be useful this week? Happy to tailor it to {{agency}}'s current stack.

Best,
{{rep}}`,
  },
  "follow-up": {
    label: "Follow-Up",
    subject: "Following up — NexCort iQ for {{agency}}",
    body: `Hi {{name}},

Quick follow-up after our conversation. Attaching a one-pager on how NexCort iQ fits alongside your CAD and helps with transcription, triage assist, and vertical ops (campus / venue / transit).

Open to a short technical deep-dive with IT + operations when you are ready.

Thanks,
{{rep}}`,
  },
  proposal: {
    label: "Proposal",
    subject: "NexCort iQ pilot proposal — {{agency}}",
    body: `Hi {{name}},

Per our discussion, here is a proposed pilot scope for {{agency}}:

• 60–90 day pilot on one console / site
• Success metrics: time-to-key-fields, supervisor visibility, QA sample quality
• Integration: read-path first; CAD write-back remains fail-closed unless you opt in

I can send a formal SOW and pricing once you confirm the pilot site and start window.

Best,
{{rep}}`,
  },
  blank: {
    label: "Blank",
    subject: "",
    body: "",
  },
};

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function SalesEmailComposer() {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(TEMPLATES.intro.subject);
  const [body, setBody] = useState(TEMPLATES.intro.body);
  const [template, setTemplate] = useState<TemplateId>("intro");
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState<PolishTone>("professional");
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [polishNotes, setPolishNotes] = useState<string[]>([]);
  const [polishMock, setPolishMock] = useState(false);
  const [outlook, setOutlook] = useState<OutlookStatus | null>(null);
  const [outlookBusy, setOutlookBusy] = useState(false);
  const [outlookError, setOutlookError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<string | null>(null);

  const canCopy = Boolean(to.trim() && subject.trim() && body.trim());
  const canPolish = body.trim().length >= SALES_EMAIL_POLISH_MIN_BODY;
  const canSend = Boolean(
    outlook?.connected && to.trim() && subject.trim() && body.trim() && !sending,
  );

  const words = useMemo(() => wordCount(body), [body]);

  async function refreshOutlook() {
    try {
      const res = await fetch("/api/sales/outlook/status");
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const payload =
        typeof json === "object" && json && "data" in json
          ? (json as { data: { outlook?: OutlookStatus } }).data
          : (json as { outlook?: OutlookStatus });
      if (payload.outlook) setOutlook(payload.outlook);
    } catch {
      /* ignore status fetch errors */
    }
  }

  useEffect(() => {
    void refreshOutlook();
  }, []);

  function applyTemplate(id: TemplateId) {
    setTemplate(id);
    setSubject(TEMPLATES[id].subject);
    setBody(TEMPLATES[id].body);
    setPolishError(null);
    setPolishNotes([]);
    setSendError(null);
    setSendOk(null);
  }

  async function copyEmail() {
    if (!canCopy) return;
    const text = [
      `To: ${to.trim()}`,
      cc.trim() ? `CC: ${cc.trim()}` : null,
      `Subject: ${subject.trim()}`,
      "",
      body.trim(),
    ]
      .filter((line) => line !== null)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function connectOutlook() {
    setOutlookBusy(true);
    setOutlookError(null);
    try {
      const res = await fetch("/api/sales/outlook/connect");
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Connect failed (${res.status})`;
        throw new Error(msg);
      }
      const payload =
        typeof json === "object" && json && "data" in json
          ? (json as { data: { authorizeUrl?: string; connected?: boolean; outlook?: OutlookStatus } })
              .data
          : (json as { authorizeUrl?: string; connected?: boolean; outlook?: OutlookStatus });
      if (payload.authorizeUrl) {
        window.location.href = payload.authorizeUrl;
        return;
      }
      if (payload.outlook) setOutlook(payload.outlook);
      else await refreshOutlook();
    } catch (err) {
      setOutlookError(err instanceof Error ? err.message : String(err));
    } finally {
      setOutlookBusy(false);
    }
  }

  async function disconnectOutlook() {
    setOutlookBusy(true);
    setOutlookError(null);
    try {
      const res = await fetch("/api/sales/outlook/disconnect", { method: "POST" });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Disconnect failed (${res.status})`;
        throw new Error(msg);
      }
      const payload =
        typeof json === "object" && json && "data" in json
          ? (json as { data: { outlook?: OutlookStatus } }).data
          : (json as { outlook?: OutlookStatus });
      setOutlook(payload.outlook ?? { configured: true, mock: false, connected: false });
    } catch (err) {
      setOutlookError(err instanceof Error ? err.message : String(err));
    } finally {
      setOutlookBusy(false);
    }
  }

  async function polishEmail() {
    if (!canPolish || polishing) return;
    setPolishing(true);
    setPolishError(null);
    try {
      const res = await fetch("/api/sales/polish-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, body, tone }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Polish failed (${res.status})`;
        throw new Error(msg);
      }
      const payload =
        typeof json === "object" && json && "data" in json
          ? (json as { data: SalesEmailPolishResult }).data
          : (json as SalesEmailPolishResult);
      if (payload.subject != null) setSubject(payload.subject);
      if (payload.body) setBody(payload.body);
      setPolishNotes(payload.notes ?? []);
      setPolishMock(payload.mock === true);
    } catch (err) {
      setPolishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolishing(false);
    }
  }

  async function sendEmail() {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    setSendOk(null);
    try {
      const res = await fetch("/api/sales/send-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to, cc, subject, body }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Send failed (${res.status})`;
        throw new Error(msg);
      }
      const payload =
        typeof json === "object" && json && "data" in json
          ? (json as { data: { mailbox?: string; mock?: boolean } }).data
          : (json as { mailbox?: string; mock?: boolean });
      setSendOk(
        payload.mock
          ? `Logged (mock) from ${payload.mailbox ?? "Outlook"}`
          : `Sent from ${payload.mailbox ?? "Outlook"}`,
      );
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Email Composer</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Draft, polish with Claude, then send from your @nexcortiq.us Outlook — or copy to paste.
          </p>
        </div>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-300">
          Claude Polish
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-[#0a1628] px-4 py-3">
        {outlook?.connected ? (
          <>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Outlook {outlook.mailbox}
              {outlook.mock ? " (mock)" : ""}
            </span>
            <button
              type="button"
              disabled={outlookBusy}
              onClick={() => void disconnectOutlook()}
              className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <span className="text-[11px] text-slate-500">
              Connect your @nexcortiq.us Outlook to send from this composer
            </span>
            <button
              type="button"
              disabled={outlookBusy}
              onClick={() => void connectOutlook()}
              className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-[10px] font-bold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
            >
              {outlookBusy ? "Connecting…" : "Connect Outlook"}
            </button>
          </>
        )}
      </div>
      {outlookError && <p className="text-xs text-rose-400">{outlookError}</p>}

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => applyTemplate(id)}
            className={[
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
              template === id
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-white/10 text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {TEMPLATES[id].label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-white/5 bg-[#0a1628] p-4 md:grid-cols-2">
        <label className="block text-xs text-slate-400">
          To
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
            placeholder="director@agency.gov"
          />
        </label>
        <label className="block text-xs text-slate-400">
          CC
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
            placeholder="optional"
          />
        </label>
        <label className="block text-xs text-slate-400 md:col-span-2">
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
          />
        </label>
        <label className="block text-xs text-slate-400 md:col-span-2">
          Body
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-[#050c1a] px-3 py-2 text-sm leading-relaxed text-slate-200 outline-none focus:border-sky-500/50"
            placeholder={
              template === "blank"
                ? "Write your email here — Polish and Send work once you have a short draft."
                : undefined
            }
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(["professional", "warm", "concise"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTone(t)}
            className={[
              "rounded-full border px-3 py-1 text-[10px] font-semibold capitalize",
              tone === t
                ? "border-violet-500 bg-violet-500/10 text-violet-300"
                : "border-white/10 text-slate-500",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {polishError && <p className="text-xs text-rose-400">{polishError}</p>}
      {sendError && <p className="text-xs text-rose-400">{sendError}</p>}
      {sendOk && <p className="text-xs text-emerald-400">{sendOk}</p>}
      {!canPolish && body.trim().length > 0 && (
        <p className="text-xs text-slate-500">
          Add a bit more body text to enable Polish (min {SALES_EMAIL_POLISH_MIN_BODY} characters).
        </p>
      )}
      {polishNotes.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#0a1628] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
              Polish notes
            </p>
            {polishMock ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                Fixture / mock
              </span>
            ) : null}
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-400">
            {polishNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">{words} words</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canPolish || polishing}
            onClick={() => void polishEmail()}
            className={[
              "rounded-full px-4 py-2 text-[11px] font-bold transition",
              canPolish && !polishing
                ? "border border-violet-500/40 bg-violet-600/20 text-violet-200 hover:bg-violet-600/30"
                : "cursor-not-allowed bg-white/5 text-slate-600",
            ].join(" ")}
          >
            {polishing ? "Polishing…" : "Polish email"}
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => void sendEmail()}
            className={[
              "rounded-full px-4 py-2 text-[11px] font-bold transition",
              canSend
                ? "border border-emerald-500/40 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30"
                : "cursor-not-allowed bg-white/5 text-slate-600",
            ].join(" ")}
          >
            {sending ? "Sending…" : "Send email"}
          </button>
          <button
            type="button"
            disabled={!canCopy}
            onClick={() => void copyEmail()}
            className={[
              "rounded-full px-4 py-2 text-[11px] font-bold transition",
              canCopy
                ? "bg-sky-600 text-white hover:bg-sky-500"
                : "cursor-not-allowed bg-white/5 text-slate-600",
            ].join(" ")}
          >
            {copied ? "Copied" : "Copy email"}
          </button>
        </div>
      </div>
    </div>
  );
}

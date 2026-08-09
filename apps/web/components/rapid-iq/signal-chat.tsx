"use client";

import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { fetchSignalChat } from "@/lib/rapid-iq/api";
import type { SignalChatMessage } from "@/lib/rapid-iq/types";

type Props = {
  opportunityId: string;
  demo?: boolean;
};

export function SignalChat({ opportunityId, demo = false }: Props) {
  const [messages, setMessages] = useState<SignalChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const userMsg: SignalChatMessage = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const reply = await fetchSignalChat(opportunityId, nextHistory, demo);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950">
      {messages.length > 0 && (
        <div className="max-h-48 space-y-2 overflow-y-auto px-4 py-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user"
                  ? "text-[11px] text-slate-300"
                  : "border-l-2 border-sky-500/30 pl-2 text-[11px] text-slate-400"
              }
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <Loader2 size={9} className="animate-spin" /> Thinking…
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-3">
        <Sparkles size={13} className="shrink-0 text-amber-400/60" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Ask anything about this signal or draft a reply…"
          className="flex-1 bg-transparent text-[11px] text-slate-300 outline-none placeholder:text-slate-600"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!input.trim() || loading}
          className="text-slate-600 transition-colors hover:text-sky-400 disabled:opacity-30"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

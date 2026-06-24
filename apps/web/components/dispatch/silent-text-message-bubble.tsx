"use client";

import type { SilentTextMessage } from "rapid-cortex-shared/silent-text/schemas";

export function SilentTextMessageBubble({
  message,
  viewAs,
}: {
  message: SilentTextMessage;
  viewAs: "dispatcher" | "caller";
}) {
  const isDispatcher = message.from === "dispatcher";
  const primary =
    viewAs === "dispatcher"
      ? isDispatcher
        ? message.body
        : (message.translatedForDispatcher ?? message.body)
      : isDispatcher
        ? (message.translatedForCaller ?? message.body)
        : message.body;

  const secondary =
    viewAs === "dispatcher" && isDispatcher && message.translatedForCaller
      ? message.translatedForCaller
      : viewAs === "caller" && !isDispatcher && message.translatedForDispatcher
        ? message.translatedForDispatcher
        : null;

  return (
    <div
      className={`rounded px-2 py-1.5 text-xs leading-snug ${
        isDispatcher ? "ml-4 bg-violet-950/40 text-violet-100" : "mr-4 bg-slate-800 text-slate-100"
      }`}
    >
      <span className="text-[9px] uppercase text-slate-500">{message.from}</span>
      <p className="mt-0.5 whitespace-pre-wrap">{primary}</p>
      {secondary ? (
        <p className="mt-1 whitespace-pre-wrap text-[10px] text-slate-400">
          {viewAs === "dispatcher" ? "Caller will see: " : "English: "}
          {secondary}
        </p>
      ) : null}
      <p className="mt-0.5 text-[9px] text-slate-500">{new Date(message.at).toLocaleTimeString()}</p>
    </div>
  );
}

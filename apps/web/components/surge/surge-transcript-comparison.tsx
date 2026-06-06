"use client";

export type TranscriptCallRow = {
  callId: string;
  timestamp: string;
  caller: string;
  transcript: string;
  uniqueInfo: string[];
};

export function SurgeTranscriptComparison({ calls }: { calls: TranscriptCallRow[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Transcript comparison ({calls.length})
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        {calls.slice(0, 6).map((call, index) => (
          <div key={call.callId} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="text-xs font-medium text-white">Caller {call.caller}</div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(call.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              {call.uniqueInfo.length > 0 ? (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                  {call.uniqueInfo.length} unique
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {call.transcript.split(/\s+/).map((word, i) => {
                const isUnique = call.uniqueInfo.some((info) =>
                  info.toLowerCase().includes(word.toLowerCase()),
                );
                return (
                  <span key={`${call.callId}-w-${i}`} className={isUnique ? "bg-amber-500/25 px-0.5" : undefined}>
                    {word}{" "}
                  </span>
                );
              })}
            </p>
            {call.uniqueInfo.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-[10px] text-amber-300/90">
                {call.uniqueInfo.map((info, i) => (
                  <li key={`${call.callId}-u-${i}`}>• {info}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
      {calls.length > 6 ? (
        <p className="mt-3 text-center text-[11px] text-slate-500">+{calls.length - 6} additional calls</p>
      ) : null}
    </div>
  );
}

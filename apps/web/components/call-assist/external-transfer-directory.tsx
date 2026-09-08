"use client";

export type ExternalTransferTarget = {
  id: string;
  name: string;
  number: string;
};

export function ExternalTransferDirectory({
  transfers,
  canTransfer,
  pending,
  onTransfer,
}: {
  transfers: ExternalTransferTarget[];
  canTransfer: boolean;
  pending: boolean;
  onTransfer: (name: string) => void;
}) {
  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
      <p className="mb-2 text-[10px] font-semibold text-slate-400">Transfer directory</p>
      {transfers.length === 0 ? (
        <p className="text-[11px] text-slate-500">No transfer targets configured.</p>
      ) : null}
      {transfers.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between border-b border-slate-800 py-1.5 last:border-0"
        >
          <span className="text-[12px] text-slate-200">{entry.name}</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">{entry.number}</span>
            {canTransfer ? (
              <button
                type="button"
                className="rounded border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400"
                onClick={() => onTransfer(entry.name)}
                disabled={pending}
              >
                Transfer
              </button>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

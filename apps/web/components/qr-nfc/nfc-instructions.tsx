"use client";

type Props = {
  url: string;
};

export function NFCInstructions({ url }: Props) {
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300">
      <h3 className="font-semibold text-slate-100">How to program an NFC tag</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>Order NTAG213 NFC stickers (search Amazon — about $15–20 per 100 tags).</li>
        <li>Download &quot;NFC Tools&quot; (free) on iOS or Android.</li>
        <li>Open NFC Tools → Write → Add Record → URL.</li>
        <li>
          Paste this URL:
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-slate-950 px-2 py-1 text-xs text-emerald-300">{url}</code>
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800"
            >
              Copy
            </button>
          </div>
        </li>
        <li>Tap Write, then hold your NFC tag to the back of your phone.</li>
        <li>Stick the programmed tag to the back of your sign.</li>
      </ol>
      <p className="mt-3 text-xs text-slate-500">
        Any modern iPhone (7+) or Android can read the tag. No app download needed for the person reporting.
      </p>
    </section>
  );
}

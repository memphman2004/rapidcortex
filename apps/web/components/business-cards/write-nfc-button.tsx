"use client";

import { useEffect, useState } from "react";
import { browserCanWriteNfc, writeNfcUrl } from "@/lib/business-cards/write-nfc";

type Props = {
  url: string;
  onWritten?: () => void;
};

export function WriteNfcButton({ url, onWritten }: Props) {
  const [canWrite, setCanWrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState("");

  useEffect(() => {
    setCanWrite(browserCanWriteNfc());
  }, []);

  async function write() {
    setBusy(true);
    setDetail("");
    try {
      await writeNfcUrl(url);
      setDetail("Tag written. Tap it with another phone to open the card.");
      onWritten?.();
    } catch (error) {
      setDetail(error instanceof Error ? error.message : "The tag was not written.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      {canWrite ? (
        <button type="button" className="rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void write()}>
          {busy ? "Hold the tag to the phone…" : "Write to tag"}
        </button>
      ) : (
        <p className="text-xs text-slate-500">Chrome on Android can write this address onto an NTAG213. This browser can copy it, and an iPhone can open it after the tag is written.</p>
      )}
      {detail ? <p className="text-xs">{detail}</p> : null}
    </div>
  );
}

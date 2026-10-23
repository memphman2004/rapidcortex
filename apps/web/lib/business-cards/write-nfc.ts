export type NfcUrlRecord = { recordType: "url"; data: string };

/** The only record a business-card sticker should carry. */
export function nfcUrlRecord(url: string): NfcUrlRecord {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The NFC address is not a valid URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("NFC tags only store https addresses.");
  return { recordType: "url", data: parsed.toString() };
}

type NdefWriter = {
  write: (message: { records: NfcUrlRecord[] }) => Promise<void>;
};

type NfcWindow = Window & { NDEFReader?: new () => NdefWriter };

export function browserCanWriteNfc(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

/** Prompt for a tap and write one URL record. Chrome on Android only. */
export async function writeNfcUrl(url: string): Promise<void> {
  const Reader = (window as NfcWindow).NDEFReader;
  if (!Reader) {
    throw new Error("This browser cannot write NFC tags. Use Chrome on an Android phone.");
  }
  const record = nfcUrlRecord(url);
  try {
    const writer = new Reader();
    await writer.write({ records: [record] });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "AbortError" || name === "NotAllowedError") {
      throw new Error("The write was cancelled. Hold the tag to the phone and try again.");
    }
    if (name === "NotSupportedError" || name === "NotReadableError") {
      throw new Error("This tag cannot store a URL. Use a blank NTAG213 sticker.");
    }
    throw error instanceof Error ? error : new Error("The tag was not written.");
  }
}

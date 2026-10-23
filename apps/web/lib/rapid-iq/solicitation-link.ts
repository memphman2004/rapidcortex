/** http(s) document URL, or null when the signal has no usable link. */
export function httpDocumentUrl(value: string | null | undefined): string | null {
  const url = value?.trim() ?? "";
  return /^https?:\/\//i.test(url) ? url : null;
}

/** Short label for the public solicitation behind a signal. */
export function solicitationLinkLabel(text: string): string {
  const hay = text.toLowerCase();
  if (/\brfi\b|request for information/.test(hay)) return "Open RFI";
  if (/\brfq\b|request for quotation/.test(hay)) return "Open RFQ";
  if (/\bitb\b|invitation to bid|\bbid\b/.test(hay)) return "Open bid";
  if (/\brfp\b|request for proposal/.test(hay)) return "Open RFP";
  return "Open RFI / RFP";
}

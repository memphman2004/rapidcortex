"use client";

function formatBody(rawBody: string): string {
  const t = rawBody.trim();
  if (t.startsWith("<") || /^<\?xml/i.test(t)) return rawBody;
  try {
    return JSON.stringify(JSON.parse(rawBody) as unknown, null, 2);
  } catch {
    return rawBody;
  }
}

type Props = {
  rawBody: string;
  className?: string;
};

export function CadRawWebhookLog({ rawBody, className = "" }: Props) {
  return (
    <pre
      className={`max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md border border-slate-800 bg-slate-950/80 p-3 font-mono text-[11px] text-slate-300 ${className}`}
    >
      {formatBody(rawBody)}
    </pre>
  );
}

"use client";

type Props = {
  text: string;
  title?: string;
};

export function VendorSetupInstructions({ text, title = "Setup instructions" }: Props) {
  return (
    <details className="rounded-lg border border-slate-800 bg-slate-900/50">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-200">{title}</summary>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3 pb-3 font-mono text-xs leading-relaxed text-slate-400">
        {text}
      </pre>
    </details>
  );
}

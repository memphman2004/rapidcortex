"use client";

import { Copy, Mail, X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  body: string;
  agencyName: string;
};

export function OutreachModal({ isOpen, onClose, subject, body, agencyName }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-200">Generated Outreach</div>
            <div className="text-[10px] text-slate-500">{agencyName}</div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-600 hover:text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-slate-800 px-4 py-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Subject
          </div>
          <div className="text-sm text-slate-200">{subject}</div>
        </div>

        <div className="max-h-80 overflow-y-auto px-4 py-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Message
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">
            {body}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
            }
            className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
          >
            <Copy size={11} /> Copy
          </button>
          <a
            href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
            className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500"
          >
            <Mail size={11} /> Open in Mail
          </a>
        </div>
      </div>
    </div>
  );
}

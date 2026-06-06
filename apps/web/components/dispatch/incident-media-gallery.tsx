"use client";

import type { IncidentMediaListItem } from "rapid-cortex-shared";

function statusLabel(s: IncidentMediaListItem["status"]): string {
  switch (s) {
    case "link_sent":
      return "Link sent";
    case "sms_failed":
      return "SMS failed";
    case "upload_url_issued":
      return "Awaiting upload";
    case "uploaded":
      return "Uploaded";
    case "expired":
      return "Expired";
    case "canceled":
      return "Canceled";
    default:
      return s;
  }
}

export function IncidentMediaGallery({ items }: { items: IncidentMediaListItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">No media requests for this incident yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((m) => (
        <li
          key={m.mediaId}
          className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/40 p-2"
        >
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-slate-500">{m.mediaId}</div>
            <div className="mt-1 text-[11px] text-slate-400">{statusLabel(m.status)}</div>
            {m.originalFileName ? (
              <div className="mt-0.5 truncate text-xs text-slate-300">{m.originalFileName}</div>
            ) : null}
            {m.contentType?.startsWith("image/") && m.downloadUrl ? (
              <img
                src={m.downloadUrl}
                alt=""
                role="presentation"
                className="mt-2 max-h-24 max-w-full rounded border border-slate-800 object-contain"
              />
            ) : null}
          </div>
          {m.downloadUrl && !m.contentType?.startsWith("image/") ? (
            <a
              href={m.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs font-medium text-sky-400 hover:underline"
            >
              Open
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

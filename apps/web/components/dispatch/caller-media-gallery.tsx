"use client";

import { useState } from "react";
import { isSupervisorOrAdmin } from "rapid-cortex-security";
import type { IncidentMediaListItem } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";

function statusLabel(s: IncidentMediaListItem["status"]): string {
  switch (s) {
    case "link_sent":
      return "Link sent";
    case "sms_failed":
      return "SMS failed";
    case "upload_url_issued":
    case "pending":
      return "Awaiting upload";
    case "uploaded":
      return "Uploaded";
    case "expired":
      return "Expired";
    case "canceled":
    case "deleted":
      return "Removed";
    default:
      return s;
  }
}

export function CallerMediaGallery({
  items,
  onDelete,
}: {
  incidentId: string;
  items: IncidentMediaListItem[];
  onDelete?: (mediaId: string) => void | Promise<void>;
}) {
  const { user } = useSession();
  const [preview, setPreview] = useState<IncidentMediaListItem | null>(null);
  const canDelete = user ? isSupervisorOrAdmin(user.role) : false;

  if (items.length === 0) {
    return <p className="text-xs text-slate-500">No caller media for this incident yet.</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((m) => {
          const isImage = m.contentType?.startsWith("image/");
          const isVideo = m.contentType?.startsWith("video/");
          return (
            <li
              key={m.mediaId}
              className="overflow-hidden rounded-md border border-slate-700/60 bg-slate-900/60"
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => m.downloadUrl && setPreview(m)}
                disabled={!m.downloadUrl}
              >
                {isImage && m.downloadUrl ? (
                  <img src={m.downloadUrl} alt="" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-slate-950 text-[10px] text-slate-500">
                    {isVideo ? "Video" : statusLabel(m.status)}
                  </div>
                )}
              </button>
              <div className="flex items-center justify-between gap-1 px-2 py-1">
                <span className="truncate text-[10px] text-slate-400">{statusLabel(m.status)}</span>
                <div className="flex gap-1">
                  {m.downloadUrl ? (
                    <a
                      href={m.downloadUrl}
                      download
                      className="text-[10px] text-sky-400 hover:text-sky-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      DL
                    </a>
                  ) : null}
                  {canDelete && onDelete ? (
                    <button
                      type="button"
                      className="text-[10px] text-rose-400 hover:text-rose-300"
                      onClick={() => void onDelete(m.mediaId)}
                    >
                      Del
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {preview?.downloadUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          onClick={() => setPreview(null)}
        >
          <div className="max-h-[90vh] max-w-4xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            {preview.contentType?.startsWith("image/") ? (
              <img src={preview.downloadUrl} alt="" className="max-h-[85vh] w-auto rounded-lg" />
            ) : preview.contentType?.startsWith("video/") ? (
              <video src={preview.downloadUrl} controls className="max-h-[85vh] w-full rounded-lg" />
            ) : (
              <a href={preview.downloadUrl} className="text-sky-300 underline" target="_blank" rel="noreferrer">
                Open media
              </a>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

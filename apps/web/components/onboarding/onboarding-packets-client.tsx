"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FolderOpen } from "lucide-react";
import {
  downloadOnboardingPacket,
  fetchOnboardingPackets,
  type OnboardingPacketFolder,
} from "@/lib/onboarding/onboarding-api";

function saveMarkdownFile(fileName: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function OnboardingPacketsClient({
  heading = "Onboarding packets",
}: {
  heading?: string;
}) {
  const listQuery = useQuery({
    queryKey: ["onboarding-packets"],
    queryFn: fetchOnboardingPackets,
  });
  const folders = listQuery.data?.folders ?? [];
  const [active, setActive] = useState<string>("");
  const current = useMemo(() => {
    if (!folders.length) return undefined;
    return folders.find((folder) => folder.vertical === active) ?? folders[0];
  }, [folders, active]);

  const downloadMut = useMutation({
    mutationFn: async (file: { vertical: OnboardingPacketFolder["vertical"]; key: string; fileName: string }) => {
      const issued = await downloadOnboardingPacket({ vertical: file.vertical, key: file.key });
      if (issued.downloadUrl) {
        window.open(issued.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (issued.markdown) {
        saveMarkdownFile(issued.fileName || file.fileName, issued.markdown);
      }
    },
  });

  if (listQuery.isLoading) {
    return <p className="text-sm text-slate-400">Loading onboarding packets…</p>;
  }
  if (listQuery.error) {
    return (
      <p className="text-sm text-rose-400">
        {listQuery.error instanceof Error ? listQuery.error.message : "Failed to load packets"}
      </p>
    );
  }
  if (!current) {
    return (
      <p className="text-sm text-slate-400">
        No onboarding packet is available for this role. RC Superadmin and Admin can open every
        vertical folder.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{heading}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Customer-facing folders for each product vertical. Share these files during discovery and
          go-live. Extra PDFs uploaded to S3 under{" "}
          <code className="rounded bg-slate-800 px-1 text-slate-200">onboarding-packets/&lt;vertical&gt;/</code>{" "}
          appear here automatically.
          {listQuery.data?.storage === "bundled" ? (
            <span className="mt-2 block text-amber-200/80">
              Showing the built-in packet (S3 folder empty or unreachable). Sync{" "}
              <code className="rounded bg-slate-800 px-1">docs/onboarding-packets</code> after deploy to
              publish the S3 copy.
            </span>
          ) : null}
        </p>
      </div>

      {folders.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {folders.map((folder) => (
            <button
              key={folder.vertical}
              type="button"
              onClick={() => setActive(folder.vertical)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                current.vertical === folder.vertical
                  ? "border-violet-400 bg-violet-500/20 text-violet-100"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {folder.title}
            </button>
          ))}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="mb-4 flex items-start gap-3">
          <FolderOpen className="mt-0.5 h-5 w-5 text-violet-300" />
          <div>
            <h2 className="text-lg font-semibold text-white">{current.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{current.summary}</p>
          </div>
        </div>
        <ul className="divide-y divide-slate-800">
          {current.files.map((file) => (
            <li key={file.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-100">{file.title}</p>
                <p className="text-xs text-slate-500">
                  {file.fileName}
                  {file.source === "s3" ? " · S3" : " · built-in"}
                </p>
              </div>
              <button
                type="button"
                disabled={downloadMut.isPending}
                onClick={() =>
                  downloadMut.mutate({
                    vertical: current.vertical,
                    key: file.key,
                    fileName: file.fileName,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </li>
          ))}
        </ul>
        {downloadMut.error ? (
          <p className="mt-3 text-sm text-rose-400">
            {downloadMut.error instanceof Error ? downloadMut.error.message : "Download failed"}
          </p>
        ) : null}
      </section>
    </div>
  );
}

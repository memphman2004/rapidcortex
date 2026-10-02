"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { isNexiqVaultEnabled } from "@/lib/runtime-flags";

type VaultJob = {
  jobId: string;
  status: string;
  fileName?: string;
  recordCount?: number;
  errorCount?: number;
  createdAt: string;
};

export default function AdminVaultPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const enabled = isNexiqVaultEnabled();

  const jobs = useQuery({
    queryKey: ["vault-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/vault/jobs", { credentials: "include" });
      if (!res.ok) throw new Error("jobs failed");
      return (await res.json()) as { jobs: VaultJob[] };
    },
    enabled,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a CSV file");
      const urlRes = await fetch("/api/vault/upload-url", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "text/csv",
          sourceSystem: "generic",
        }),
      });
      if (!urlRes.ok) throw new Error("upload-url failed");
      const { uploadUrl } = (await urlRes.json()) as { uploadUrl: string };
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "text/csv" },
        body: file,
      });
      if (!put.ok) throw new Error("S3 upload failed");
    },
    onSuccess: () => {
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["vault-jobs"] });
    },
  });

  const role = (user?.role ?? "").toLowerCase();
  const canAdmin =
    role === "agencyadmin" || role === "agencyit" || role === "rcsuperadmin" || role === "rcadmin";

  if (!enabled) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        NexiQ Vault is not enabled for this deployment.
      </div>
    );
  }

  if (!canAdmin) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        Vault upload is limited to agency administrators.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8 text-slate-100">
      <header>
        <h1 className="text-2xl font-semibold">NexiQ Vault admin</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload prior-CAD CSV exports (generic NexCort template). CAD/call records only — no JMS.
        </p>
      </header>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={!file || upload.isPending}
          onClick={() => upload.mutate()}
          className="rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {upload.isPending ? "Uploading…" : "Upload & ingest"}
        </button>
        {upload.isError ? (
          <p className="text-sm text-red-400">{(upload.error as Error).message}</p>
        ) : null}
        {upload.isSuccess ? (
          <p className="text-sm text-emerald-400">Upload started — refresh job history shortly.</p>
        ) : null}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Ingestion jobs
        </h2>
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 text-sm">
          {(jobs.data?.jobs ?? []).length === 0 ? (
            <li className="px-4 py-6 text-slate-500">No jobs yet.</li>
          ) : (
            jobs.data!.jobs.map((job) => (
              <li key={job.jobId} className="flex justify-between gap-4 px-4 py-3">
                <div>
                  <div className="font-medium">{job.fileName ?? job.jobId}</div>
                  <div className="text-slate-500">{job.createdAt.slice(0, 19)}</div>
                </div>
                <div className="text-right text-slate-400">
                  <div>{job.status}</div>
                  <div>
                    {job.recordCount ?? 0} ok · {job.errorCount ?? 0} err
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

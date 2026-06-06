"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-context";
import {
  fetchDesktopReleasesOverview,
  isApiConfigured,
  postDesktopReleaseSignedUrl,
} from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import type { DesktopPlatform, DesktopReleaseCard, DesktopReleasesOverviewResponse } from "rapid-cortex-shared";

function formatBytes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const UNAUTHORIZED_COPY =
  "Desktop downloads are available only to agency administrators and IT administrators.";

function DesktopCard({
  card,
  canDownload,
  downloadLabel,
  busy,
  onDownload,
}: {
  card: DesktopReleaseCard;
  canDownload: boolean;
  downloadLabel: string;
  busy: boolean;
  onDownload: () => void | Promise<void>;
}) {
  return (
    <section
      className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5"
      aria-label={card.platform === "macos" ? "macOS download" : "Windows download"}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
        {card.platform === "macos" ? "macOS" : "Windows"}
      </h2>
      <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500">Version</dt>
          <dd>{card.version}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Release date</dt>
          <dd>{card.releasedAt ? new Date(card.releasedAt).toLocaleDateString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">File size</dt>
          <dd>{formatBytes(card.fileBytes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Minimum OS</dt>
          <dd>{card.minOSVersion}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">SHA-256 checksum</dt>
          <dd className="break-all font-mono text-xs text-slate-400">{card.sha256 ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Artifact</dt>
          <dd className="font-mono text-xs text-slate-400">{card.artifactFileName}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Installation</dt>
          <dd className="text-slate-400">{card.installationNotes}</dd>
        </div>
      </dl>
      {canDownload && card.available ? (
        <div className="mt-6">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDownload()}
            className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Preparing…" : downloadLabel}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Opens a short-lived signed download link. Platform super administrators may also use this
            action. The installed app still requires Rapid Cortex sign-in before any incident data is
            available.
          </p>
        </div>
      ) : null}
      {canDownload && !card.available ? (
        <p className="mt-4 text-sm text-slate-500">
          No installer is published for this environment. Set the matching{" "}
          <span className="font-mono text-slate-400">
            {card.platform === "macos" ? "DESKTOP_MACOS_S3_KEY" : "DESKTOP_WINDOWS_S3_KEY"}
          </span>{" "}
          in the API stack and upload the file to the private assets bucket.
        </p>
      ) : null}
    </section>
  );
}

export default function AdminDesktopDownloadsPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const [overview, setOverview] = useState<DesktopReleasesOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlatform, setBusyPlatform] = useState<DesktopPlatform | null>(null);

  const load = useCallback(async () => {
    if (!isApiConfigured()) {
      setError("API is not configured in this build.");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const r = await fetchDesktopReleasesOverview();
      setOverview(r);
    } catch (e) {
      setOverview(null);
      setError(e instanceof Error ? e.message : "Failed to load desktop releases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canDownload =
    user?.role === "agencyadmin" || user?.role === "agencyit" || user?.role === "rcsuperadmin";

  async function handleDownload(platform: DesktopPlatform) {
    setBusyPlatform(platform);
    setError(null);
    try {
      const { downloadUrl } = await postDesktopReleaseSignedUrl(platform);
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusyPlatform(null);
    }
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
        <Link href={to("/admin/settings")} className="text-slate-400 hover:text-sky-400 hover:underline">
          Settings
        </Link>
        <span className="mx-1.5 text-slate-600" aria-hidden>
          →
        </span>
        <span className="text-slate-400">Downloads</span>
        <span className="mx-1.5 text-slate-600" aria-hidden>
          →
        </span>
        <span className="font-medium text-slate-300">Desktop Apps</span>
      </nav>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Desktop Apps</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Installers live in <strong className="font-medium text-slate-300">private S3</strong> only. Metadata
            loads over the API; each download requests a <strong className="font-medium text-slate-300">short-lived</strong>{" "}
            presigned HTTPS URL (audited). See{" "}
            <span className="font-mono text-slate-300">docs/DESKTOP_DOWNLOAD_FLOW.md</span> and{" "}
            <span className="font-mono text-slate-300">docs/DESKTOP_DISTRIBUTION_OPTION_1.md</span>.
          </p>
        </div>
        <Link
          href={to("/admin/settings")}
          className="shrink-0 text-sm text-sky-400 hover:text-sky-300 hover:underline"
        >
          ← Settings
        </Link>
      </div>

      {user && !canDownload ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-100/90">
          {UNAUTHORIZED_COPY}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {overview && canDownload ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <DesktopCard
            card={overview.macos}
            canDownload={canDownload}
            downloadLabel="Download for Mac"
            busy={busyPlatform === "macos"}
            onDownload={() => handleDownload("macos")}
          />
          <DesktopCard
            card={overview.windows}
            canDownload={canDownload}
            downloadLabel="Download for Windows"
            busy={busyPlatform === "windows"}
            onDownload={() => handleDownload("windows")}
          />
        </div>
      ) : null}
    </div>
  );
}

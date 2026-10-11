"use client";

/**
 * NexCort iQ — Help Panel (slide-out drawer)
 */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHelpPanel } from "./help-panel-context";
import { FeatureArchitectureMaps } from "@/components/help/feature-architecture-maps";
import { fetchHelpArticle, type HelpArticleContent } from "@/lib/help/fetch-help-article";
import { getHelpIndex, type HelpArticle, type HelpIndex } from "@/lib/help/help-content";
import { getTrainingVideosForRole, type TrainingVideo } from "@/lib/help/video-library";
import { fetchStaffGuideArticle } from "@/lib/staff-guide/fetch-article";
import {
  getStaffGuideIndex,
  isStaffGuideRole,
  staffGuideVerticalFromRole,
} from "@/lib/staff-guide/catalog";
import { isStaffGuideEnabled } from "@/lib/runtime-flags";
import { V } from "@/lib/theme/rc-theme-tokens";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

const INTERACTIVE_ARCHITECTURE_TOPIC = "feature-architecture-maps";

function jurisdictionFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  if (!first || first === "rc-admin" || first === "app" || first === "api" || first === "help" || first === "docs" || first === "sales") {
    return null;
  }
  return first;
}

function documentLibraryHref(role: string, pathname: string | null): string {
  const r = role.toLowerCase().replace(/-/g, "_");
  if (r === "rcsuperadmin" || r === "rcadmin" || r === "rcitadmin") {
    return "/rc-admin/document-library";
  }
  if (r === "salescontractor" || r === "sales_contractor") {
    return "/sales/document-library";
  }
  const j = jurisdictionFromPath(pathname) ?? defaultJurisdictionSlug();
  if (r === "agencyadmin" || r === "agencyit") {
    return `/${j}/admin/document-library`;
  }
  // Dispatchers and other PSAP ops roles use the non-admin library (middleware blocks /admin/*).
  return `/${j}/document-library`;
}

function ArticleView({
  role,
  article,
  staffGuide,
  onBack,
  libraryHref,
}: {
  role: string;
  article: HelpArticle;
  staffGuide: boolean;
  onBack: () => void;
  libraryHref: string;
}) {
  const isArchitectureMaps = article.topic === INTERACTIVE_ARCHITECTURE_TOPIC;
  const [content, setContent] = useState<HelpArticleContent | null>(null);
  const [loading, setLoading] = useState(!isArchitectureMaps);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (isArchitectureMaps) {
      setLoading(false);
      setMissing(false);
      setContent(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    setContent(null);
    const vertical = staffGuideVerticalFromRole(role);
    const load = staffGuide && vertical
      ? fetchStaffGuideArticle(vertical, article.topic)
      : fetchHelpArticle(role, article.topic);
    void load.then((result) => {
      if (cancelled) return;
      if (result) setContent(result);
      else setMissing(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [role, article.topic, staffGuide, isArchitectureMaps]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${V.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: V.muted,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            padding: "3px 0",
          }}
        >
          <ArrowLeft size={13} />
          All articles
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: V.text, margin: "0 0 6px" }}>
          {article.title}
        </h2>
        <p style={{ fontSize: 12, color: V.muted, margin: "0 0 20px", lineHeight: 1.5 }}>
          {article.description}
        </p>

        {isArchitectureMaps ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FeatureArchitectureMaps compact />
            <Link
              href={libraryHref}
              style={{
                fontSize: 12,
                color: V.purple,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ExternalLink size={11} />
              Open full Document Library
            </Link>
          </div>
        ) : null}

        {!isArchitectureMaps && loading ? (
          <div style={{ fontSize: 12, color: V.dim, fontFamily: "monospace" }}>Loading…</div>
        ) : null}

        {!isArchitectureMaps && missing && !loading ? (
          <div
            style={{
              background: V.surfaceAlt,
              border: `1px solid ${V.border}`,
              borderRadius: 8,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: V.silver, marginBottom: 6 }}>
              Article coming soon
            </div>
            <div style={{ fontSize: 12, color: V.muted, lineHeight: 1.6 }}>
              This guide is being written. In the meantime, contact support at{" "}
              <a
                href="mailto:support@nexcortiq.us"
                style={{ color: V.purple, textDecoration: "none" }}
              >
                support@nexcortiq.us
              </a>{" "}
              or check the release notes for details.
            </div>
          </div>
        ) : null}

        {!isArchitectureMaps && content && !loading ? (
          <>
            <div
              style={{ fontSize: 13, lineHeight: 1.7, color: V.text }}
              dangerouslySetInnerHTML={{ __html: content.html }}
            />
            <div
              style={{
                marginTop: 28,
                paddingTop: 16,
                borderTop: `1px solid ${V.border}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
            {staffGuide ? null : (
              <>
                <Link
                  href={libraryHref}
                  style={{
                    fontSize: 11,
                    color: V.purple,
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <ExternalLink size={11} />
                  Open document library
                </Link>
                <span style={{ fontSize: 11, color: V.dim }}>·</span>
              </>
            )}
              <a
                href="mailto:support@nexcortiq.us"
                style={{ fontSize: 11, color: V.dim, textDecoration: "none" }}
              >
                Send feedback
              </a>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(status: TrainingVideo["status"]): string {
  if (status === "live") return "LIVE";
  if (status === "scripted") return "READY TO FILM";
  return "PLANNED";
}

function ArticleIndex({
  index,
  videos,
  onSelect,
}: {
  index: HelpIndex;
  videos: TrainingVideo[];
  onSelect: (article: HelpArticle) => void;
}) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "12px 0" }}>
      {index.map((section) => (
        <div key={section.section}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: V.muted,
              padding: "8px 20px 4px",
              fontFamily: "monospace",
            }}
          >
            {section.section.toUpperCase()}
          </div>
          {section.articles.map((article) => (
            <button
              type="button"
              key={article.topic}
              onClick={() => onSelect(article)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                borderBottom: `1px solid ${V.border}`,
                padding: "10px 20px",
                cursor: "pointer",
                display: "block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = V.surfaceAlt;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: V.text, marginBottom: 3 }}>
                {article.title}
              </div>
              <div style={{ fontSize: 11, color: V.muted, lineHeight: 1.4 }}>
                {article.description}
              </div>
            </button>
          ))}
        </div>
      ))}

      {videos.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: V.muted,
              padding: "8px 20px 4px",
              fontFamily: "monospace",
            }}
          >
            TRAINING VIDEOS
          </div>
          {videos.map((video) => {
            const body = (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 3,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: V.text, flex: 1 }}>
                    {video.title}
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: video.status === "live" ? "#4ade80" : V.dim,
                      fontFamily: "monospace",
                    }}
                  >
                    {statusLabel(video.status)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: V.muted, lineHeight: 1.4 }}>
                  {video.description} · {video.duration}
                </div>
              </>
            );
            if (video.status === "live" && video.url) {
              return (
                <a
                  key={video.id}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "10px 20px",
                    borderBottom: `1px solid ${V.border}`,
                    textDecoration: "none",
                  }}
                >
                  {body}
                </a>
              );
            }
            return (
              <div
                key={video.id}
                style={{
                  padding: "10px 20px",
                  borderBottom: `1px solid ${V.border}`,
                }}
              >
                {body}
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ padding: "16px 20px", borderTop: `1px solid ${V.border}`, marginTop: 8 }}>
        <div style={{ fontSize: 11, color: V.dim, marginBottom: 6 }}>Need more help?</div>
        <a
          href="mailto:support@nexcortiq.us"
          style={{
            fontSize: 12,
            color: V.purple,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ExternalLink size={11} />
          Contact support
        </a>
      </div>
    </div>
  );
}

export function HelpPanel() {
  const { isOpen, activeTopic, role, closeHelp, openHelp } = useHelpPanel();
  const pathname = usePathname();
  const [activeArticle, setActiveArticle] = useState<HelpArticle | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const staffGuide = isStaffGuideEnabled() && isStaffGuideRole(role);
  const vertical = staffGuideVerticalFromRole(role);
  const helpIndex: HelpIndex =
    staffGuide && vertical ? getStaffGuideIndex(vertical) : getHelpIndex(role);
  const trainingVideos = getTrainingVideosForRole(role);
  const libraryHref = documentLibraryHref(role, pathname);
  const architectureOpen = activeArticle?.topic === INTERACTIVE_ARCHITECTURE_TOPIC;

  useEffect(() => {
    if (!isOpen) return;
    if (activeTopic === "index") {
      setActiveArticle(null);
      return;
    }
    for (const section of helpIndex) {
      const found = section.articles.find((a) => a.topic === activeTopic);
      if (found) {
        setActiveArticle(found);
        return;
      }
    }
    setActiveArticle(null);
  }, [isOpen, activeTopic, helpIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeHelp]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={closeHelp}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 999,
        }}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={staffGuide ? "Staff Guide" : "Help & Documentation"}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: architectureOpen ? "min(720px, calc(100vw - 24px))" : 380,
          background: V.surface,
          borderLeft: `1px solid ${V.border}`,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 16px",
            height: 52,
            borderBottom: `1px solid ${V.border}`,
            background: V.bg,
            flexShrink: 0,
          }}
        >
          <BookOpen size={15} color={V.purple} />
          <span style={{ fontSize: 13, fontWeight: 700, color: V.text, flex: 1 }}>
            {staffGuide ? "Staff Guide" : "Help & Documentation"}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.07em",
              color: V.purple,
              background: "var(--rc-violet-dim)",
              border: "1px solid var(--rc-violet-border)",
              padding: "2px 7px",
              borderRadius: 999,
              fontFamily: "monospace",
            }}
          >
            {role.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={closeHelp}
            aria-label="Close help panel"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: V.muted,
              display: "flex",
              alignItems: "center",
              padding: "4px",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${V.border}`, flexShrink: 0 }}>
          <input
            type="search"
            placeholder={staffGuide ? "Search staff guide…" : "Search help articles…"}
            style={{
              width: "100%",
              background: V.bg,
              border: `1px solid ${V.border}`,
              borderRadius: 6,
              color: V.text,
              fontSize: 12,
              padding: "7px 10px",
              outline: "none",
              boxSizing: "border-box",
            }}
            onChange={() => {
              /* client-side filter in a later sprint */
            }}
          />
        </div>

        {activeArticle ? (
          <ArticleView
            role={role}
            article={activeArticle}
            staffGuide={staffGuide}
            libraryHref={libraryHref}
            onBack={() => {
              setActiveArticle(null);
              openHelp("index");
            }}
          />
        ) : (
          <ArticleIndex
            index={helpIndex}
            videos={trainingVideos}
            onSelect={setActiveArticle}
          />
        )}
      </div>
    </>
  );
}

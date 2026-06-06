"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { DemoShareRow } from "@/components/marketing/demo/demo-share-row";

export const DEMO_VIDEOS = [
  {
    id: "aBfBsM7TCrI",
    title: "Intelligence at the Speed of Response",
    description:
      "A walkthrough of the Rapid Cortex platform from dispatcher workspace to supervisor dashboard.",
    duration: "1:08",
    category: "Overview" as const,
  },
  {
    id: "dNWFG0tx5kw",
    title: "Live Transcription",
    description:
      "Watch how Rapid Cortex transcribes a 911 call in real time and generates an incident summary in under 2 seconds.",
    duration: "1:36",
    category: "Features" as const,
  },
  {
    id: "YJT44fq5BGs",
    title: "CAD Integration Setup",
    description: "Connecting Rapid Cortex to your CAD system.",
    duration: "1:00",
    category: "Setup" as const,
  },
  {
    id: "A9C9YgncKrI",
    title: "Supervisor Overview",
    description:
      "How supervisors use the command view to monitor active incidents and dispatch team performance in real time.",
    duration: "1:35",
    category: "Features" as const,
  },
  {
    id: "zcZn6dWLeks",
    title: "Product Overview — Web, Desktop App, and RC Lite API",
    description:
      "For developers and agency IT teams; how easy it is to integrate Rapid Cortex into your existing systems.",
    duration: "1:46",
    category: "Developers" as const,
  },
  {
    id: "FU6Nfei6-fs",
    playlistId: "PLQF5lJISQEZV-0OGyCrDLCT3wMGtY6wDJ",
    title: "Rapid Cortex Campus: Not every emergency begins with a phone call",
    description:
      "Campus safety operations for K-12 and university teams — patrol workflows, incident coordination, and intelligence beyond traditional phone intake.",
    duration: "Series",
    category: "Campus" as const,
  },
] as const;

export type DemoVideoCategory = (typeof DEMO_VIDEOS)[number]["category"];
export type DemoVideoFilter = "All" | DemoVideoCategory;

const FILTER_TABS: DemoVideoFilter[] = ["All", "Overview", "Features", "Setup", "Developers", "Campus"];

function categoryBadgeClass(cat: DemoVideoCategory): string {
  switch (cat) {
    case "Overview":
      return "bg-sky-600/95 text-white";
    case "Features":
      return "bg-emerald-600/95 text-white";
    case "Setup":
      return "bg-amber-500/95 text-slate-950";
    case "Developers":
      return "bg-violet-600/95 text-white";
    case "Campus":
      return "bg-emerald-500/95 text-slate-950";
    default:
      return "bg-slate-600 text-white";
  }
}

function youtubeThumbUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

function embedUrl(video: (typeof DEMO_VIDEOS)[number]): string {
  const base = `https://www.youtube-nocookie.com/embed/${video.id}`;
  const params = new URLSearchParams({ autoplay: "0", rel: "0" });
  if ("playlistId" in video && video.playlistId) {
    params.set("list", video.playlistId);
  }
  return `${base}?${params.toString()}`;
}

function isValidVideoId(id: string | undefined): id is string {
  return !!id && DEMO_VIDEOS.some((v) => v.id === id);
}

export type DemoVideoGalleryProps = {
  shareUrl: string;
};

export function DemoVideoGallery({ shareUrl }: DemoVideoGalleryProps) {
  const pathname = usePathname();
  const [filter, setFilter] = useState<DemoVideoFilter>("All");
  const [activeId, setActiveId] = useState<string>(DEMO_VIDEOS[0]!.id);

  const filtered = useMemo(() => {
    if (filter === "All") return [...DEMO_VIDEOS];
    return DEMO_VIDEOS.filter((v) => v.category === filter);
  }, [filter]);

  const active = useMemo(
    () => DEMO_VIDEOS.find((v) => v.id === activeId) ?? DEMO_VIDEOS[0]!,
    [activeId],
  );

  const syncHashToState = useCallback(() => {
    if (typeof window === "undefined") return;
    const raw = window.location.hash.replace(/^#/, "").trim();
    if (isValidVideoId(raw)) {
      setActiveId(raw);
    }
  }, []);

  useLayoutEffect(() => {
    syncHashToState();
  }, [syncHashToState]);

  useEffect(() => {
    const onHash = () => syncHashToState();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [syncHashToState]);

  const selectVideo = useCallback(
    (id: string) => {
      if (!isValidVideoId(id)) return;
      setActiveId(id);
      const base = pathname && pathname !== "/" ? pathname : "/demo";
      window.history.replaceState(null, "", `${base}#${id}`);
    },
    [pathname],
  );

  useEffect(() => {
    if (!filtered.some((v) => v.id === activeId)) {
      const first = filtered[0];
      if (first) selectVideo(first.id);
    }
  }, [filtered, activeId, selectVideo]);

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <div className="demo-video-feature transition-opacity duration-300 ease-out">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-700/80 bg-black shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)]">
          <iframe
            key={activeId}
            title={active.title}
            src={embedUrl(active)}
            className="demo-video-iframe absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="mt-5 space-y-2 px-0.5">
          <h3 className="text-lg font-semibold text-white sm:text-xl">{active.title}</h3>
          <p className="text-sm leading-relaxed text-slate-400 sm:text-base">{active.description}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-3">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              filter === tab
                ? "bg-sky-600 text-white shadow-sm shadow-sky-900/40"
                : "bg-slate-900/80 text-slate-400 ring-1 ring-slate-700/80 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-x-visible sm:pb-0">
        {filtered.map((video) => {
          const selected = video.id === activeId;
          return (
            <button
              key={video.id}
              type="button"
              onClick={() => selectVideo(video.id)}
              className={`group relative w-[min(200px,72vw)] shrink-0 overflow-hidden rounded-lg border text-left transition-all duration-300 ease-out sm:w-[180px] ${
                selected
                  ? "scale-[1.02] border-transparent ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950"
                  : "border-slate-700/80 hover:scale-[1.02] hover:border-slate-500"
              }`}
            >
              <span
                className={`absolute left-2 top-2 z-10 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${categoryBadgeClass(video.category)}`}
              >
                {video.category}
              </span>
              <span className="absolute bottom-2 right-2 z-10 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
                {video.duration}
              </span>
              <div className="relative aspect-video w-full bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbnails; avoid remotePatterns churn */}
                <img
                  src={youtubeThumbUrl(video.id)}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
              <p className="line-clamp-2 bg-[#0f172a] px-2 py-2 text-xs font-medium leading-snug text-slate-200">
                {video.title}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-10">
        <DemoShareRow shareUrl={shareUrl} />
      </div>

      <style>{`
        .demo-video-iframe {
          animation: demoVidEnter 0.35s ease-out;
        }
        @keyframes demoVidEnter {
          from {
            opacity: 0.88;
            transform: scale(0.996);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

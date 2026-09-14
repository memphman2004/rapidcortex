"use client";

import type { VideoWallLayout } from "rapid-cortex-shared";
import { VIDEO_WALL_LAYOUT_OPTIONS } from "@/lib/video/video-wall-layouts";

export function VideoWallToolbar({
  layout,
  onLayout,
  statusFilter,
  onStatusFilter,
  section,
  onSection,
  building,
  onBuilding,
  sections,
  buildings,
  summary,
  onOpenRecordings,
}: {
  layout: VideoWallLayout;
  onLayout: (layout: VideoWallLayout) => void;
  statusFilter: "all" | "online" | "offline";
  onStatusFilter: (v: "all" | "online" | "offline") => void;
  section: string;
  onSection: (v: string) => void;
  building: string;
  onBuilding: (v: string) => void;
  sections: string[];
  buildings: string[];
  summary: { online: number; total: number } | null;
  onOpenRecordings?: () => void;
}) {
  return (
    <div
      className="flex h-12 shrink-0 items-center gap-3 px-3"
      style={{ background: "#100e1e", borderBottom: "1px solid #1a1528" }}
    >
      <div className="flex items-center gap-1">
        {VIDEO_WALL_LAYOUT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="rounded px-2 py-1 text-[11px]"
            style={{
              color: layout === opt.id ? "#c4b5fd" : "#8b7bb5",
              background: layout === opt.id ? "#4c1d95" : "transparent",
            }}
            onClick={() => onLayout(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <select
        className="rounded bg-transparent px-2 py-1 text-[11px]"
        style={{ color: "#c4b5fd", border: "1px solid #1a1528" }}
        value={statusFilter}
        onChange={(e) => onStatusFilter(e.target.value as "all" | "online" | "offline")}
      >
        <option value="all">All status</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
      </select>
      {sections.length > 0 ? (
        <select
          className="rounded bg-transparent px-2 py-1 text-[11px]"
          style={{ color: "#c4b5fd", border: "1px solid #1a1528" }}
          value={section}
          onChange={(e) => onSection(e.target.value)}
        >
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ) : null}
      {buildings.length > 0 ? (
        <select
          className="rounded bg-transparent px-2 py-1 text-[11px]"
          style={{ color: "#c4b5fd", border: "1px solid #1a1528" }}
          value={building}
          onChange={(e) => onBuilding(e.target.value)}
        >
          <option value="">All buildings</option>
          {buildings.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      ) : null}
      <div className="ml-auto flex items-center gap-3 text-[11px]" style={{ color: "#8b7bb5" }}>
        {onOpenRecordings ? (
          <button
            type="button"
            className="rounded px-2 py-1 uppercase"
            style={{ color: "#c4b5fd", border: "1px solid #1a1528" }}
            onClick={onOpenRecordings}
          >
            Recordings
          </button>
        ) : null}
        {summary ? `${summary.online}/${summary.total} online` : null}
      </div>
    </div>
  );
}

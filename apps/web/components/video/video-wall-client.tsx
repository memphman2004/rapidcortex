"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { VideoTileAssignment, VideoWallLayout } from "rapid-cortex-shared";
import { concurrentStreamLimitForRole, videoWallCellCount } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import type { CameraApiVertical } from "@/lib/venue/venue-camera-api";
import { fetchVenueCameraRegistry } from "@/lib/venue/venue-camera-api";
import { fetchVideoCameraHealth, fetchVideoWallConfig, saveVideoWallConfig } from "@/lib/video/video-wall-api";
import { isRcVideoEnabled } from "@/lib/runtime-flags";
import { VideoTileFullscreen } from "./VideoTileFullscreen";
import { VideoWallGrid } from "./VideoWallGrid";
import { VideoWallSidebar } from "./VideoWallSidebar";
import { VideoWallToolbar } from "./VideoWallToolbar";
import { VideoDVR } from "./VideoDVR";

function parseFilterParam(raw: string | null): { section: string; building: string } {
  if (!raw) return { section: "", building: "" };
  if (raw.startsWith("section:")) return { section: raw.slice("section:".length), building: "" };
  if (raw.startsWith("building:")) return { section: "", building: raw.slice("building:".length) };
  return { section: "", building: "" };
}

export function VideoWallClient({
  agencyId,
  apiVertical,
}: {
  agencyId: string;
  apiVertical: CameraApiVertical;
}) {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const enabled = isRcVideoEnabled();
  const initialFilter = parseFilterParam(searchParams.get("filter"));
  const layoutParam = searchParams.get("layout") as VideoWallLayout | null;

  const [layout, setLayout] = useState<VideoWallLayout>(
    layoutParam === "1x1" || layoutParam === "2x2" || layoutParam === "3x3" || layoutParam === "4x4" || layoutParam === "custom"
      ? layoutParam
      : "2x2",
  );
  const [tiles, setTiles] = useState<VideoTileAssignment[]>([]);
  const [cameras, setCameras] = useState<VideoTileAssignment[]>([]);
  const [streamLimit, setStreamLimit] = useState(() => concurrentStreamLimitForRole(user?.role ?? "dispatcher"));
  const [selectedPosition, setSelectedPosition] = useState<number | null>(0);
  const [fullscreenPos, setFullscreenPos] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [section, setSection] = useState(initialFilter.section);
  const [building, setBuilding] = useState(initialFilter.building);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ online: number; total: number } | null>(null);
  const [showRecordings, setShowRecordings] = useState(() => searchParams.get("tab") === "recordings");

  useEffect(() => {
    if (!enabled || !agencyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [wall, health, registry] = await Promise.all([
          fetchVideoWallConfig(agencyId).catch(() => ({ config: null, streamLimit: streamLimit })),
          fetchVideoCameraHealth(agencyId).catch(() => null),
          fetchVenueCameraRegistry(agencyId, apiVertical).catch(() => []),
        ]);
        if (cancelled) return;
        setStreamLimit(wall.streamLimit);
        if (wall.config) {
          setTiles(wall.config.tiles);
          if (
            layoutParam !== "1x1" &&
            layoutParam !== "2x2" &&
            layoutParam !== "3x3" &&
            layoutParam !== "4x4" &&
            layoutParam !== "custom"
          ) {
            setLayout(wall.config.layout);
          }
        }
        const fromRegistry: VideoTileAssignment[] = registry.map((c, i) => ({
          position: i,
          cameraId: c.cameraId,
          kvsChannelName: c.kvsChannelName,
          displayName: c.displayName,
          vendor: c.vendor,
          ptzCapable: c.ptzCapable,
          section: c.sections[0],
          buildingId: c.buildingId,
          status: c.status,
        }));
        const healthById = new Map((health?.cameras ?? []).map((c) => [c.cameraId, c]));
        const merged: VideoTileAssignment[] =
          fromRegistry.length > 0
            ? fromRegistry.map((c) => {
                const h = healthById.get(c.cameraId);
                return h ? { ...c, status: h.status, kvsChannelName: h.kvsChannelName || c.kvsChannelName } : c;
              })
            : (health?.cameras ?? []).map((c, i) => ({ ...c, position: c.position ?? i }));
        setCameras(merged);
        if (health?.summary) setSummary({ online: health.summary.online, total: health.summary.total });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load video wall");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId, apiVertical, enabled, layoutParam]);

  const persist = useCallback(
    async (nextLayout: VideoWallLayout, nextTiles: VideoTileAssignment[]) => {
      setError(null);
      try {
        const saved = await saveVideoWallConfig(agencyId, { layout: nextLayout, tiles: nextTiles });
        setTiles(saved.config.tiles);
        setLayout(saved.config.layout);
        setStreamLimit(saved.streamLimit);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save wall");
      }
    },
    [agencyId],
  );

  const assignCamera = useCallback(
    (position: number, cameraId: string) => {
      const cam = cameras.find((c) => c.cameraId === cameraId);
      if (!cam) return;
      const without = tiles.filter((t) => t.position !== position && t.cameraId !== cameraId);
      const next: VideoTileAssignment[] = [
        ...without,
        {
          ...cam,
          position,
        },
      ];
      if (next.length > streamLimit) {
        setError(`Your role may open at most ${streamLimit} live streams at once.`);
        return;
      }
      void persist(layout, next);
    },
    [cameras, layout, persist, streamLimit, tiles],
  );

  const filteredCameras = useMemo(() => {
    return cameras.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (section && c.section !== section) return false;
      if (building && c.buildingId !== building) return false;
      return true;
    });
  }, [building, cameras, section, statusFilter]);

  const sections = useMemo(
    () => [...new Set(cameras.map((c) => c.section).filter((s): s is string => Boolean(s)))],
    [cameras],
  );
  const buildings = useMemo(
    () => [...new Set(cameras.map((c) => c.buildingId).filter((s): s is string => Boolean(s)))],
    [cameras],
  );

  const fullscreenTile = fullscreenPos != null ? tiles.find((t) => t.position === fullscreenPos) : undefined;
  const selectedCamera =
    (selectedPosition != null ? tiles.find((t) => t.position === selectedPosition) : undefined) ??
    tiles[0] ??
    cameras[0];

  if (!enabled) {
    return <p className="p-6 text-sm text-slate-400">NexiQ Video is disabled.</p>;
  }

  return (
    <div className="-m-4 flex h-[calc(100vh-8rem)] min-h-[480px] flex-col" style={{ background: "#080610" }}>
      <VideoWallToolbar
        layout={layout}
        onLayout={(next) => {
          const max = videoWallCellCount(next);
          const clipped = tiles.filter((t) => t.position < max);
          setLayout(next);
          void persist(next, clipped);
        }}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        section={section}
        onSection={setSection}
        building={building}
        onBuilding={setBuilding}
        sections={sections}
        buildings={buildings}
        summary={summary}
        onOpenRecordings={() => setShowRecordings((v) => !v)}
      />
      {error ? (
        <div className="px-3 py-1 text-[11px]" style={{ color: "#fca5a5" }}>
          {error}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <VideoWallSidebar
          cameras={filteredCameras}
          onAssign={(cameraId) => {
            const pos = selectedPosition ?? tiles.length;
            assignCamera(Math.min(pos, videoWallCellCount(layout) - 1), cameraId);
          }}
        />
        <VideoWallGrid
          agencyId={agencyId}
          apiVertical={apiVertical}
          layout={layout}
          tiles={tiles}
          selectedPosition={selectedPosition}
          onSelect={setSelectedPosition}
          onFullscreen={setFullscreenPos}
          onAssign={assignCamera}
        />
        {showRecordings ? (
          <div className="w-[360px] shrink-0 overflow-y-auto" style={{ borderLeft: "1px solid #1a1528" }}>
            {selectedCamera ? (
              <VideoDVR
                agencyId={agencyId}
                cameraId={selectedCamera.cameraId}
                displayName={selectedCamera.displayName}
              />
            ) : (
              <p className="p-3 text-[11px]" style={{ color: "#8b7bb5" }}>
                Select a camera to review recordings.
              </p>
            )}
          </div>
        ) : null}
      </div>
      {fullscreenTile ? (
        <VideoTileFullscreen
          agencyId={agencyId}
          apiVertical={apiVertical}
          tile={fullscreenTile}
          onClose={() => setFullscreenPos(null)}
        />
      ) : null}
    </div>
  );
}

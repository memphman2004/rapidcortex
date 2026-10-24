import { DOCK_MODULE_LABELS, DOCK_MODULES, isDockModuleKey, type DockModuleKey } from "@/lib/dispatcher/module-dock";

/** Products that are off stay out of the module list so the columns do not grow. */
export function visibleDockModules(flags: {
  callerCard: boolean;
  liveVideo: boolean;
  incidentMedia: boolean;
  silentText: boolean;
  preArrival: boolean;
  pinpoint: boolean;
  cameraAi: boolean;
}): Array<{ key: DockModuleKey; label: string }> {
  return DOCK_MODULES.filter((item) => {
    if (item.key === "camera_ai") return flags.cameraAi;
    if (item.key === "silent_text") return flags.silentText;
    if (item.key === "pre_arrival") return flags.preArrival;
    if (item.key === "pinpoint") return flags.pinpoint;
    if (item.key === "caller_mobile") return flags.liveVideo || flags.incidentMedia;
    if (item.key === "location" || item.key === "premise_notes") return flags.callerCard;
    return true;
  });
}

const EXTRA_SECTIONS = ["queue", "unit_board", "cad_ready", "context"] as const;

export type DispatcherPopoutSection = DockModuleKey | (typeof EXTRA_SECTIONS)[number];

const EXTRA_LABELS: Record<(typeof EXTRA_SECTIONS)[number], string> = {
  queue: "Queue",
  unit_board: "Unit board",
  cad_ready: "CAD-ready",
  context: "Context",
};

export const POPOUT_SECTION_LABELS: Record<DispatcherPopoutSection, string> = {
  ...DOCK_MODULE_LABELS,
  ...EXTRA_LABELS,
};

export function isDispatcherPopoutSection(value: string | null | undefined): value is DispatcherPopoutSection {
  if (!value) return false;
  if (isDockModuleKey(value)) return true;
  return (EXTRA_SECTIONS as readonly string[]).includes(value);
}

export function isDispatcherPopoutPath(pathname: string): boolean {
  const segs = pathname.split("/").filter(Boolean);
  const i = segs.indexOf("dispatcher");
  return i >= 0 && segs[i + 1] === "popout";
}

/** Same-origin window for one dispatcher section. Incident id keeps the window on that call. */
export function dispatcherSectionPopoutPath(
  jurisdiction: string,
  section: DispatcherPopoutSection,
  incidentId?: string | null,
): string {
  const base = `/${encodeURIComponent(jurisdiction)}/dispatcher/popout`;
  const params = new URLSearchParams({ section });
  if (incidentId) params.set("incident", incidentId);
  return `${base}?${params.toString()}`;
}

export function openDispatcherSectionWindow(
  jurisdiction: string,
  section: DispatcherPopoutSection,
  incidentId?: string | null,
): Window | null {
  if (typeof window === "undefined") return null;
  const url = dispatcherSectionPopoutPath(jurisdiction, section, incidentId);
  const features = [
    "popup=yes",
    "width=1100",
    "height=800",
    "left=80",
    "top=40",
    "menubar=no",
    "toolbar=no",
    "location=yes",
    "status=no",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
  const name = `rc-dispatch-${jurisdiction}-${section}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const opened = window.open(url, name, features);
  if (!opened) return null;
  try {
    const next = new URL(url, window.location.origin).href;
    if (opened.location.href !== next) opened.location.href = url;
  } catch {
    /* The named window is already this origin; ignore a transient access miss. */
  }
  opened.focus();
  return opened;
}

export function dockModuleKeys(): DockModuleKey[] {
  return DOCK_MODULES.map((item) => item.key);
}

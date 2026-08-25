/** Lower-ops module dock: slot state only. Never persist incident data or PII. */

export const DOCK_MODULES = [
  { key: "transcript", label: "Transcript" },
  { key: "incident_picture", label: "Incident Picture" },
  { key: "caller_mobile", label: "Caller Mobile" },
  { key: "silent_text", label: "Silent Text Link" },
  { key: "pinpoint", label: "Rapid Cortex Pinpoint" },
  { key: "location", label: "Location" },
  { key: "premise_notes", label: "Premise Notice" },
  { key: "map", label: "Map" },
] as const;

export type DockModuleKey = (typeof DOCK_MODULES)[number]["key"];
export type DockFocusedSlot = "left" | "right";

export type DockState = {
  leftSlot: DockModuleKey | null;
  rightSlot: DockModuleKey | null;
  split: boolean;
  focusedSlot: DockFocusedSlot;
};

export const DOCK_MODULE_LABELS: Record<DockModuleKey, string> = {
  transcript: "Transcript",
  incident_picture: "Incident Picture",
  caller_mobile: "Caller Mobile",
  silent_text: "Silent Text Link",
  pinpoint: "Rapid Cortex Pinpoint",
  location: "Location",
  premise_notes: "Premise Notice",
  map: "Map",
};

const CORE_KEYS = new Set<string>(DOCK_MODULES.map((m) => m.key));

export function isDockModuleKey(value: string | null | undefined): value is DockModuleKey {
  return typeof value === "string" && CORE_KEYS.has(value);
}

/** Empty until a module is opened from the left rail. */
export const DEFAULT_DOCK_STATE: DockState = {
  leftSlot: null,
  rightSlot: null,
  split: false,
  focusedSlot: "left",
};

export type DockAction =
  | { type: "open"; key: DockModuleKey }
  | { type: "toggleSplit" }
  | { type: "swap" }
  | { type: "focus"; slot: DockFocusedSlot }
  | { type: "close"; slot: DockFocusedSlot };

export function reduceDock(state: DockState, action: DockAction): DockState {
  switch (action.type) {
    case "focus": {
      if (!state.split && action.slot === "right") return { ...state, focusedSlot: "left" };
      return { ...state, focusedSlot: action.slot };
    }
    case "toggleSplit": {
      if (state.split) {
        return { ...state, split: false, focusedSlot: "left" };
      }
      const rightSlot =
        state.rightSlot && state.rightSlot !== state.leftSlot ? state.rightSlot : null;
      return {
        ...state,
        split: true,
        rightSlot,
        // Empty right pane is the next drop target so a rail click fills it.
        focusedSlot: rightSlot == null ? "right" : state.focusedSlot,
      };
    }
    case "swap": {
      if (!state.split) return state;
      return {
        ...state,
        leftSlot: state.rightSlot,
        rightSlot: state.leftSlot,
        focusedSlot: state.focusedSlot === "left" ? "right" : "left",
      };
    }
    case "close": {
      if (action.slot === "right") {
        return { ...state, rightSlot: null, focusedSlot: "left" };
      }
      return { ...state, leftSlot: null, focusedSlot: state.split ? "right" : "left" };
    }
    case "open": {
      const key = action.key;
      if (state.leftSlot === key) return { ...state, focusedSlot: "left" };
      if (state.split && state.rightSlot === key) return { ...state, focusedSlot: "right" };
      if (!state.split) {
        return { ...state, leftSlot: key, focusedSlot: "left" };
      }
      // Vacant pane first — Split with one module must accept a second click.
      if (state.leftSlot == null) {
        return { ...state, leftSlot: key, focusedSlot: "left" };
      }
      if (state.rightSlot == null) {
        return { ...state, rightSlot: key, focusedSlot: "right" };
      }
      if (state.focusedSlot === "right") {
        return { ...state, rightSlot: key };
      }
      return { ...state, leftSlot: key };
    }
    default:
      return state;
  }
}

export function dockRowClass(
  leftSlot: DockModuleKey | null,
  rightSlot: DockModuleKey | null,
  key: DockModuleKey,
  split: boolean,
): string {
  const inLeft = leftSlot === key;
  const inRight = split && rightSlot === key;
  const parts = ["module-picker-row"];
  if (inLeft) parts.push("in-left");
  if (inRight) parts.push("in-right");
  return parts.join(" ");
}

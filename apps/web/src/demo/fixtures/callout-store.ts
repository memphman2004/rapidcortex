import type { GuidedHighlight } from "../types";
import { DEMO_STORAGE_PREFIX } from "../engine/demo-mode-gate";

const KEY = `${DEMO_STORAGE_PREFIX}callouts`;

type CalloutOverride = { title?: string; description?: string };

function readOverrides(): Record<string, CalloutOverride> {
  if (typeof window === "undefined") return memoryOverrides;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, CalloutOverride>) : {};
  } catch {
    return memoryOverrides;
  }
}

let memoryOverrides: Record<string, CalloutOverride> = {};
let revision = 0;
const listeners = new Set<() => void>();

export function subscribeCallouts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCalloutRevision(): number {
  return revision;
}

export function getCalloutCopy(highlight: GuidedHighlight): GuidedHighlight {
  const override = readOverrides()[highlight.id];
  if (!override) return highlight;
  return {
    ...highlight,
    title: override.title ?? highlight.title,
    description: override.description ?? highlight.description,
  };
}

export function updateCalloutCopy(id: string, override: CalloutOverride): void {
  const next = { ...readOverrides(), [id]: { ...readOverrides()[id], ...override } };
  memoryOverrides = next;
  revision += 1;
  listeners.forEach((listener) => listener());
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function resetCalloutOverridesForTests(): void {
  memoryOverrides = {};
}

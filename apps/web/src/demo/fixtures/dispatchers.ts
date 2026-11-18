import type { DemoDispatcher } from "../types";

/**
 * Fictional roster. These names are invented for Maplewood County and are the
 * only dispatcher identities Demo Mode is allowed to show.
 */
export const MAPLEWOOD_DISPATCHERS: readonly DemoDispatcher[] = [
  { id: "D-01", name: "Alex Carver", role: "Lead Dispatcher", position: 1, onShift: false, remote: false },
  { id: "D-02", name: "Morgan Reyes", role: "Dispatcher", position: 2, onShift: false, remote: false },
  { id: "D-03", name: "Jordan Hale", role: "Dispatcher", position: 3, onShift: false, remote: false },
  { id: "D-04", name: "Sam Okafor", role: "Dispatcher", position: 4, onShift: false, remote: false },
  { id: "D-05", name: "Casey Vance", role: "Supervisor", position: null, onShift: false, remote: false },
  { id: "D-06", name: "Robin Lau", role: "Dispatcher", position: null, onShift: false, remote: false },
];

export function rosterOnShift(
  onShiftIds: readonly string[],
  options?: { remoteIds?: readonly string[] },
): DemoDispatcher[] {
  const remote = new Set(options?.remoteIds ?? []);
  return MAPLEWOOD_DISPATCHERS.map((dispatcher) => ({
    ...dispatcher,
    onShift: onShiftIds.includes(dispatcher.id),
    remote: remote.has(dispatcher.id),
  }));
}

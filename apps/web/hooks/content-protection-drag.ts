/** Intentional UI drag (Kanban cards, etc.) — not free-text extraction. */
export function isAllowedDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("input, textarea, select, [contenteditable='true']")) return true;
  return Boolean(target.closest('[draggable="true"], [data-allow-drag="true"]'));
}

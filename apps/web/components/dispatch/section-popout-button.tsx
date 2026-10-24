"use client";

export function SectionPopOutButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="shrink-0 px-1 text-[11px] leading-none text-[var(--rc-text-muted)] hover:text-[var(--rc-text)]"
      title={`Open ${label} in its own window`}
      aria-label={`Open ${label} in its own window`}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onClick();
      }}
    >
      ↗
    </button>
  );
}

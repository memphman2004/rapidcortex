"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { useTypographyPreference } from "@/components/providers/typography-preference-provider";
import { useTheme } from "@/lib/theme/theme-context";
import {
  USER_TEXT_FACTORY,
  USER_TEXT_ROLE_HELP,
  USER_TEXT_ROLE_LABELS,
  USER_TEXT_ROLES,
  paletteForMode,
  resolvedRoleColor,
  type UserTextMode,
  type UserTextRole,
} from "@/lib/theme/user-text-palette";

function SwatchButton({
  hex,
  selected,
  onSelect,
  label,
}: {
  hex: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={selected}
      title={hex}
      className="h-7 w-7 shrink-0 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--role-accent,#0ea5e9)]"
      style={{
        background: hex,
        borderColor: selected ? "var(--rc-text-primary)" : "var(--rc-border-hard)",
        boxShadow: selected ? "0 0 0 2px var(--rc-bg), 0 0 0 4px var(--role-accent, #0ea5e9)" : undefined,
      }}
    />
  );
}

function RoleRow({
  role,
  mode,
  editingRole,
  onEdit,
}: {
  role: UserTextRole;
  mode: UserTextMode;
  editingRole: UserTextRole | null;
  onEdit: (role: UserTextRole | null) => void;
}) {
  const { textColors, setRoleColor } = useTypographyPreference();
  const current = resolvedRoleColor(textColors, mode, role);
  const custom = Boolean(textColors[mode][role]);
  const open = editingRole === role;
  const swatches = useMemo(() => paletteForMode(mode), [mode]);
  const families = useMemo(() => {
    const map = new Map<string, typeof swatches>();
    for (const swatch of swatches) {
      const list = map.get(swatch.family) ?? [];
      list.push(swatch);
      map.set(swatch.family, list);
    }
    return [...map.entries()];
  }, [swatches]);

  return (
    <div className="rounded-lg border border-[color:var(--rc-border)] bg-[color:var(--rc-surface-alt)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--rc-text-primary)]">{USER_TEXT_ROLE_LABELS[role]}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--rc-text-muted)]">{USER_TEXT_ROLE_HELP[role]}</p>
        </div>
        <button
          type="button"
          onClick={() => onEdit(open ? null : role)}
          className="flex items-center gap-2 rounded-md border border-[color:var(--rc-border)] bg-[color:var(--rc-surface)] px-2 py-1.5"
          aria-expanded={open}
          aria-label={`Choose ${USER_TEXT_ROLE_LABELS[role]} color`}
        >
          <span
            className="h-5 w-5 rounded-full border border-[color:var(--rc-border-hard)]"
            style={{ background: current }}
          />
          <span className="font-mono text-[10px] text-[color:var(--rc-text-secondary)]">{current}</span>
        </button>
      </div>
      {open ? (
        <div className="mt-3 space-y-2 border-t border-[color:var(--rc-border)] pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--rc-text-muted)]">
              Palette · {mode === "dark" ? "dark background" : "light background"}
            </p>
            <button
              type="button"
              onClick={() => setRoleColor(mode, role, null)}
              className="text-[11px] font-medium text-[color:var(--rc-text-secondary)] hover:text-[color:var(--rc-text-primary)]"
            >
              Default
            </button>
          </div>
          <p className="text-[10px] text-[color:var(--rc-text-muted)]">
            Shades that fail contrast on this background are hidden.
          </p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {families.map(([family, items]) => (
              <div key={family} className="flex items-center gap-1.5">
                {items.map((swatch) => (
                  <SwatchButton
                    key={swatch.id}
                    hex={swatch.hex}
                    selected={current.toUpperCase() === swatch.hex.toUpperCase() && custom}
                    onSelect={() => setRoleColor(mode, role, swatch.hex)}
                    label={`${family} ${swatch.hex}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LivePreview({ mode }: { mode: UserTextMode }) {
  const { textColors } = useTypographyPreference();
  const primary = resolvedRoleColor(textColors, mode, "primary");
  const secondary = resolvedRoleColor(textColors, mode, "secondary");
  const labels = resolvedRoleColor(textColors, mode, "labels");
  const transcript = resolvedRoleColor(textColors, mode, "transcript");
  const bg = mode === "dark" ? "#0a0812" : "#ffffff";
  const card = mode === "dark" ? "#100e1a" : "#f4f5f9";

  return (
    <div className="rounded-lg border border-[color:var(--rc-border)] p-3" style={{ background: bg }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: labels }}>
        Live preview
      </p>
      <p className="mt-1 text-sm font-semibold" style={{ color: primary }}>
        Traffic stop · 5th & Main
      </p>
      <p className="mt-1 text-[12px] leading-snug" style={{ color: secondary }}>
        Supporting description for the incident. This uses secondary text.
      </p>
      <p className="mt-2 font-mono text-[12px] leading-relaxed" style={{ color: transcript }}>
        Caller: He is still in the driveway. Dispatcher: Units are en route.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-400 ring-1 ring-red-500/40">
          Priority 1
        </span>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400 ring-1 ring-amber-500/40">
          En route
        </span>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-400 ring-1 ring-emerald-500/40">
          Available
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-snug" style={{ color: labels }}>
        Status, priority, and alert colors stay NexCort iQ operational colors — they cannot be changed here.
      </p>
      <div className="mt-2 rounded border border-red-800/60 bg-red-950/80 px-2 py-1.5 text-[11px] text-red-200">
        Alert banner sample — emergency red is locked.
      </div>
      <p className="mt-2 hidden text-[10px]" style={{ color: card }}>
        {USER_TEXT_FACTORY[mode].primary}
      </p>
    </div>
  );
}

export function TextAppearancePanel({ onClose }: { onClose?: () => void }) {
  const { theme } = useTheme();
  const { resetAllTextColors, resetMode } = useTypographyPreference();
  const [mode, setMode] = useState<UserTextMode>(theme);
  const [editingRole, setEditingRole] = useState<UserTextRole | null>(null);

  useEffect(() => {
    setMode(theme);
  }, [theme]);

  return (
    <div className="flex max-h-[min(36rem,80vh)] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[color:var(--rc-border)] bg-[color:var(--rc-surface)] shadow-xl">
      <div className="border-b border-[color:var(--rc-border)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--rc-text-muted)]">
          Settings · Appearance · Text Colors
        </p>
        <h2 className="mt-0.5 text-sm font-semibold text-[color:var(--rc-text-primary)]">Workspace typography</h2>
        <p className="mt-1 text-[11px] leading-snug text-[color:var(--rc-text-secondary)]">
          Personalize normal UI text. Emergency red, warning amber, success green, status badges, maps, and
          incident-priority colors stay locked.
        </p>
      </div>
      <div className="flex gap-1 border-b border-[color:var(--rc-border)] px-3 py-2">
        {(["dark", "light"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMode(item);
              setEditingRole(null);
            }}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
              mode === item
                ? "bg-[color:var(--rc-surface-hover)] text-[color:var(--rc-text-primary)]"
                : "text-[color:var(--rc-text-muted)] hover:text-[color:var(--rc-text-primary)]"
            }`}
          >
            {item === "dark" ? "Dark mode" : "Light mode"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <LivePreview mode={mode} />
        {USER_TEXT_ROLES.map((role) => (
          <RoleRow key={role} role={role} mode={mode} editingRole={editingRole} onEdit={setEditingRole} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--rc-border)] px-3 py-2.5">
        <button
          type="button"
          onClick={() => resetMode(mode)}
          className="text-[11px] font-medium text-[color:var(--rc-text-secondary)] hover:text-[color:var(--rc-text-primary)]"
        >
          Default {mode}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetAllTextColors}
            className="text-[11px] font-medium text-[color:var(--rc-text-secondary)] hover:text-[color:var(--rc-text-primary)]"
          >
            Reset all
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[color:var(--role-accent,#0ea5e9)] px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TextColorPicker() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Text colors"
        title="Text colors"
        className="inline-flex items-center gap-1.5 rounded border border-[color:var(--rc-border)] bg-[color:var(--rc-surface)] px-2 py-1 text-[11px] font-medium text-[color:var(--rc-text-primary)] outline-none transition hover:border-[color:var(--rc-border-hover)]"
      >
        <Palette className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Color</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.4rem)] z-50">
          <TextAppearancePanel onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

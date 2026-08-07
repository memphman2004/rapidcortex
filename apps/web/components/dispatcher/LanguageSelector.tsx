/**
 * LanguageSelector.tsx
 * Dynamic language selector for the dispatcher console.
 *
 * REPLACES the hardcoded 5-language array currently in the dispatcher
 * incident view. Fetches the full list from /api/call-intelligence/languages
 * (100+ languages, Azure Translator primary + Google Translate fallback).
 *
 * PLACEMENT:
 *   apps/web/src/components/dispatcher/LanguageSelector.tsx
 *
 * FIND AND REPLACE in the dispatcher incident component:
 *   Search for the hardcoded array:
 *     const LANGUAGES = [
 *       { code: "en", label: "English" },
 *       { code: "es", label: "Spanish" },
 *       ...
 *     ]
 *   Or the inline options:
 *     <option value="en">en — English</option>
 *     <option value="es">es — Spanish</option>
 *     ...
 *
 *   Replace the entire language dropdown with:
 *     <LanguageSelector
 *       value={selectedLanguage}
 *       onChange={(code) => setSelectedLanguage(code)}
 *       onSave={(code) => handleSaveLanguage(code)}  // also invoked on select
 *       saving={savingLanguage}
 *     />
 *
 * API SHAPE consumed from /api/call-intelligence/languages:
 *   {
 *     ok: boolean
 *     count: number
 *     languages: Array<{
 *       code: string          // BCP-47 e.g. "es", "zh-Hans", "ar"
 *       name?: string         // English display name if returned
 *       direction?: string    // "rtl" for Arabic, Hebrew, Farsi, Urdu
 *       capabilities?: {
 *         speechToText?: boolean   // live transcription supported
 *         translation?: boolean    // translation supported
 *       }
 *     }>
 *   }
 */

"use client";

import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  type KeyboardEvent,
} from "react";
import { V } from "@/lib/theme/rc-theme-tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiLanguage {
  code: string;
  name?: string;
  direction?: string;
  capabilities?: {
    speechToText?: boolean;
    translation?: boolean;
  };
}

interface Language {
  code: string;
  label: string;       // display name
  native?: string;     // name in the language itself (for recognition)
  direction: "ltr" | "rtl";
  canTranslate: boolean;
  canTranscribe: boolean;
  pinned: boolean;     // appears in priority group at top
}

interface LanguageSelectorProps {
  /** Currently selected BCP-47 code */
  value: string;
  /** Called when selection changes (before save) */
  onChange: (code: string) => void;
  /** Called when "Save language" is clicked with the selected code */
  onSave?: (code: string) => void;
  /** Disable interaction while a save is in flight */
  saving?: boolean;
  /** Optional override to fetch from a different endpoint */
  apiPath?: string;
}

// ─── Priority languages pinned to the top of the list ─────────────────────────
// These are the most common in US emergency communications.
// Everything else appears alphabetically below a divider.

const PINNED_CODES = new Set([
  "en", "es", "zh-Hans", "zh-Hant", "zh",
  "vi", "ar", "ko", "tl", "ru",
  "fr", "pt", "de", "ht", "am",
  "so", "fa", "ur", "hi", "ja",
]);

// Fallback display names — used when the API doesn't return a name field
const FALLBACK_NAMES: Record<string, [string, string]> = {
  // [English name, native name]
  "en":      ["English",        "English"],
  "es":      ["Spanish",        "Español"],
  "zh-Hans": ["Chinese (Simp)", "中文(简体)"],
  "zh-Hant": ["Chinese (Trad)", "中文(繁體)"],
  "zh":      ["Chinese",        "中文"],
  "vi":      ["Vietnamese",     "Tiếng Việt"],
  "ar":      ["Arabic",         "العربية"],
  "ko":      ["Korean",         "한국어"],
  "tl":      ["Tagalog",        "Tagalog"],
  "ru":      ["Russian",        "Русский"],
  "fr":      ["French",         "Français"],
  "pt":      ["Portuguese",     "Português"],
  "de":      ["German",         "Deutsch"],
  "ht":      ["Haitian Creole", "Kreyòl ayisyen"],
  "am":      ["Amharic",        "አማርኛ"],
  "so":      ["Somali",         "Soomaali"],
  "fa":      ["Farsi",          "فارسی"],
  "ur":      ["Urdu",           "اردو"],
  "hi":      ["Hindi",          "हिन्दी"],
  "ja":      ["Japanese",       "日本語"],
  "pl":      ["Polish",         "Polski"],
  "it":      ["Italian",        "Italiano"],
  "uk":      ["Ukrainian",      "Українська"],
  "ro":      ["Romanian",       "Română"],
  "nl":      ["Dutch",          "Nederlands"],
  "sv":      ["Swedish",        "Svenska"],
  "tr":      ["Turkish",        "Türkçe"],
  "he":      ["Hebrew",         "עברית"],
  "bn":      ["Bengali",        "বাংলা"],
  "th":      ["Thai",           "ภาษาไทย"],
  "id":      ["Indonesian",     "Bahasa Indonesia"],
  "ms":      ["Malay",          "Bahasa Melayu"],
  "sw":      ["Swahili",        "Kiswahili"],
};

const RTL_CODES = new Set(["ar", "fa", "ur", "he", "yi", "ps", "dv", "ug"]);

// ─── Design tokens (theme-aware) ──────────────────────────────────────────────

const C = {
  bg: V.bg,
  surface: V.surface,
  card: V.surface,
  cardHover: V.cardHover,
  border: V.border,
  borderFocus: V.borderFocus,
  purple: V.purple,
  purpleDim: V.purpleDim,
  blue: V.blue,
  blueDim: V.blueDim,
  green: V.green,
  greenDim: V.greenDim,
  amber: V.amber,
  red: V.red,
  textPrimary: V.textPrimary,
  textSecondary: V.textSecondary,
  textMuted: V.textMuted,
  scrollbar: V.scrollbar,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function displayName(code: string, apiName?: string): string {
  if (apiName) return apiName;
  return FALLBACK_NAMES[code]?.[0] ?? code;
}

function nativeName(code: string): string | undefined {
  return FALLBACK_NAMES[code]?.[1];
}

function isRtl(code: string): boolean {
  return RTL_CODES.has(code) || code.startsWith("ar") || code.startsWith("fa") || code.startsWith("ur");
}

function normalizeApiLanguage(l: ApiLanguage): Language {
  return {
    code:         l.code,
    label:        displayName(l.code, l.name),
    native:       nativeName(l.code),
    direction:    (l.direction === "rtl" || isRtl(l.code)) ? "rtl" : "ltr",
    canTranslate: l.capabilities?.translation !== false,
    canTranscribe:l.capabilities?.speechToText === true,
    pinned:       PINNED_CODES.has(l.code),
  };
}

// ─── Hook: fetch language list ─────────────────────────────────────────────────

function useLanguages(apiPath: string) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiPath, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { languages?: ApiLanguage[] };
      const list = (data.languages ?? [])
        .filter((l) => l.capabilities?.translation !== false)
        .map(normalizeApiLanguage)
        .sort((a, b) => {
          // Pinned first (in PINNED_CODES insertion order), then alpha
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return a.label.localeCompare(b.label);
        });
      setLanguages(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load languages");
      // Fall back to the 5 hardcoded languages so the UI doesn't break
      setLanguages([
        { code:"en", label:"English",    direction:"ltr", canTranslate:true, canTranscribe:true,  pinned:true },
        { code:"es", label:"Spanish",    direction:"ltr", canTranslate:true, canTranscribe:true,  pinned:true },
        { code:"zh", label:"Chinese",    direction:"ltr", canTranslate:true, canTranscribe:false, pinned:true },
        { code:"vi", label:"Vietnamese", direction:"ltr", canTranslate:true, canTranscribe:false, pinned:true },
        { code:"ar", label:"Arabic",     direction:"rtl", canTranslate:true, canTranscribe:false, pinned:true },
      ]);
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => { void fetch_(); }, [fetch_]);

  return { languages, loading, error, reload: fetch_ };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function STTBadge() {
  return (
    <span
      title="Live transcription supported in this language"
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: C.green,
        background: C.greenDim,
        border: `1px solid rgba(16,185,129,0.25)`,
        borderRadius: 3,
        padding: "1px 4px",
        flexShrink: 0,
      }}
    >
      STT
    </span>
  );
}

function LangRow({
  lang,
  selected,
  onSelect,
}: {
  lang: Language;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            8,
        padding:        "8px 12px",
        cursor:         "pointer",
        background:     selected ? C.purpleDim : "transparent",
        borderLeft:     `2px solid ${selected ? C.purple : "transparent"}`,
        transition:     "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.background = C.cardHover;
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Language name + code */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize:   13,
            fontWeight: selected ? 600 : 400,
            color:      selected ? C.textPrimary : C.textSecondary,
            whiteSpace: "nowrap",
            overflow:   "hidden",
            textOverflow: "ellipsis",
          }}>
            {lang.label}
          </span>
          {lang.canTranscribe && <STTBadge />}
          {lang.direction === "rtl" && (
            <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 600 }}>RTL</span>
          )}
        </div>
        {lang.native && lang.native !== lang.label && (
          <span
            dir={lang.direction}
            style={{
              fontSize:  11,
              color:     C.textMuted,
              fontStyle: "italic",
            }}
          >
            {lang.native}
          </span>
        )}
      </div>

      {/* Code chip + checkmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{
          fontSize:        10,
          fontWeight:      600,
          fontFamily:      "monospace",
          color:           C.textMuted,
          background:      C.card,
          border:          `1px solid ${C.border}`,
          borderRadius:    3,
          padding:         "1px 5px",
          letterSpacing:   "0.04em",
        }}>
          {lang.code}
        </span>
        {selected && (
          <svg viewBox="0 0 16 16" fill="none" width={14} height={14}>
            <path
              d="M3 8l4 4 6-7"
              stroke={C.purple}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LanguageSelector({
  value,
  onChange,
  onSave,
  saving = false,
  apiPath = "/api/call-intelligence/languages",
}: LanguageSelectorProps) {
  const { languages, loading, error } = useLanguages(apiPath);

  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Filtered + split into pinned / extended groups
  const { pinned, extended } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? languages.filter(
          (l) =>
            l.label.toLowerCase().includes(q) ||
            l.code.toLowerCase().includes(q) ||
            (l.native?.toLowerCase().includes(q) ?? false)
        )
      : languages;
    return {
      pinned:   filtered.filter((l) => l.pinned),
      extended: filtered.filter((l) => !l.pinned),
    };
  }, [languages, search]);

  const selected = languages.find((l) => l.code === value);

  function handleSelect(code: string) {
    onChange(code);
    // Persist immediately when a save handler is provided — the Save footer button is inside
    // this panel, and closing on select made “pick Vietnamese but never save” a common miss.
    onSave?.(code);
    setOpen(false);
    setSearch("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { setOpen(false); setSearch(""); }
  }

  // ── Trigger button ──────────────────────────────────────────────────────────
  const triggerLabel = loading
    ? "Loading…"
    : selected
    ? `${selected.code} — ${selected.label}`
    : value
    ? value
    : "Select language";

  return (
    <div
      ref={wrapperRef}
      onKeyDown={handleKeyDown}
      style={{ position: "relative", display: "inline-block", minWidth: 200 }}
    >
      {/* ── Trigger ── */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={loading || saving}
        onClick={() => setOpen((o) => !o)}
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            8,
          width:          "100%",
          padding:        "6px 10px",
          background:     open ? C.purpleDim : C.card,
          border:         `1px solid ${open ? C.purple : C.border}`,
          borderRadius:   6,
          color:          loading ? C.textMuted : C.textPrimary,
          fontSize:       13,
          cursor:         loading || saving ? "not-allowed" : "pointer",
          transition:     "border-color 0.15s, background 0.15s",
          fontFamily:     "inherit",
          whiteSpace:     "nowrap",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {triggerLabel}
        </span>
        {/* Chevron */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          width={12}
          height={12}
          style={{
            flexShrink: 0,
            transform:  open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            color:      C.textMuted,
          }}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="listbox"
          aria-label="Select call language"
          style={{
            position:     "absolute",
            top:          "calc(100% + 4px)",
            left:         0,
            zIndex:       9999,
            width:        300,
            background:   C.surface,
            border:       `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow:    "0 16px 48px rgba(0,0,0,0.8)",
            display:      "flex",
            flexDirection:"column",
            overflow:     "hidden",
          }}
        >
          {/* Search input */}
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ position: "relative" }}>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width={13}
                height={13}
                style={{
                  position:       "absolute",
                  left:           8,
                  top:            "50%",
                  transform:      "translateY(-50%)",
                  color:          C.textMuted,
                  pointerEvents:  "none",
                }}
              >
                <circle cx={7} cy={7} r={4.5} stroke="currentColor" strokeWidth={1.5} />
                <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder={`Search ${languages.length} languages…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width:        "100%",
                  padding:      "6px 8px 6px 28px",
                  background:   C.card,
                  border:       `1px solid ${C.border}`,
                  borderRadius: 5,
                  color:        C.textPrimary,
                  fontSize:     12,
                  outline:      "none",
                  boxSizing:    "border-box",
                  fontFamily:   "inherit",
                }}
              />
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              padding:    "6px 12px",
              fontSize:   11,
              color:      "#fca5a5",
              background: "rgba(239,68,68,0.08)",
              borderBottom: `1px solid rgba(239,68,68,0.2)`,
            }}>
              ⚠ Using offline list — {error}
            </div>
          )}

          {/* STT legend */}
          {!error && (
            <div style={{
              padding:      "4px 12px",
              fontSize:     10,
              color:        C.textMuted,
              borderBottom: `1px solid ${C.border}`,
              display:      "flex",
              alignItems:   "center",
              gap:          5,
            }}>
              <STTBadge /> Live transcription available
            </div>
          )}

          {/* Language list */}
          <div
            ref={listRef}
            style={{
              overflowY:  "auto",
              maxHeight:  340,
              scrollbarWidth: "thin",
              scrollbarColor: `${C.scrollbar} transparent`,
            }}
          >
            {/* Pinned / common languages */}
            {pinned.length > 0 && (
              <>
                <div style={{
                  padding:       "5px 12px 3px",
                  fontSize:      9,
                  fontWeight:    700,
                  letterSpacing: "0.08em",
                  color:         C.textMuted,
                  textTransform: "uppercase",
                }}>
                  Common
                </div>
                {pinned.map((lang) => (
                  <LangRow
                    key={lang.code}
                    lang={lang}
                    selected={lang.code === value}
                    onSelect={() => handleSelect(lang.code)}
                  />
                ))}
              </>
            )}

            {/* Extended language list */}
            {extended.length > 0 && (
              <>
                <div style={{
                  padding:       "5px 12px 3px",
                  fontSize:      9,
                  fontWeight:    700,
                  letterSpacing: "0.08em",
                  color:         C.textMuted,
                  textTransform: "uppercase",
                  borderTop:     pinned.length > 0 ? `1px solid ${C.border}` : undefined,
                  marginTop:     pinned.length > 0 ? 4 : 0,
                }}>
                  All languages ({extended.length})
                </div>
                {extended.map((lang) => (
                  <LangRow
                    key={lang.code}
                    lang={lang}
                    selected={lang.code === value}
                    onSelect={() => handleSelect(lang.code)}
                  />
                ))}
              </>
            )}

            {/* Empty state */}
            {pinned.length === 0 && extended.length === 0 && (
              <div style={{
                padding:   "24px 12px",
                textAlign: "center",
                fontSize:  12,
                color:     C.textMuted,
              }}>
                No languages match &ldquo;{search}&rdquo;
              </div>
            )}
          </div>

          {/* Footer: count + save */}
          <div style={{
            padding:      "8px 10px",
            borderTop:    `1px solid ${C.border}`,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "space-between",
            gap:          8,
          }}>
            <span style={{ fontSize: 10, color: C.textMuted }}>
              {languages.length} languages available
            </span>
            {onSave && (
              <button
                type="button"
                disabled={saving || !value}
                onClick={() => { onSave(value); setOpen(false); }}
                style={{
                  padding:      "5px 12px",
                  background:   C.purpleDim,
                  border:       `1px solid ${C.purple}`,
                  borderRadius: 5,
                  color:        "#a78bfa",
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       saving ? "wait" : "pointer",
                  fontFamily:   "inherit",
                  opacity:      saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving…" : "Save language"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

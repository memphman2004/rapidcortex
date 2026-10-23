"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CardTheme } from "@/lib/business-cards/form";

export type PhoneCardLink = { label: string; href: string; eventType?: string };

export const THEME_PRESETS: Record<
  CardTheme,
  {
    label: string;
    detail: string;
    cover: string;
    screen: string;
    ink: string;
    muted: string;
    accent: string;
    panel: string;
    swatch: string;
    dark: boolean;
  }
> = {
  navy: {
    label: "NexCort Signature",
    detail: "Navy and purple",
    cover: "linear-gradient(165deg, #1e1b4b 0%, #4c1d95 48%, #7c3aed 100%)",
    screen: "#f7f5fb",
    ink: "#0f172a",
    muted: "#64748b",
    accent: "#6d28d9",
    panel: "#ffffff",
    swatch: "linear-gradient(135deg, #312e81, #7c3aed)",
    dark: false,
  },
  midnight: {
    label: "Executive Dark",
    detail: "Black and charcoal",
    cover: "linear-gradient(165deg, #020617 0%, #111827 55%, #334155 100%)",
    screen: "#0b1220",
    ink: "#f8fafc",
    muted: "#94a3b8",
    accent: "#38bdf8",
    panel: "#111827",
    swatch: "linear-gradient(135deg, #020617, #334155)",
    dark: true,
  },
  slate: {
    label: "Modern Blue",
    detail: "Blue gradient",
    cover: "linear-gradient(165deg, #0c4a6e 0%, #0369a1 50%, #38bdf8 100%)",
    screen: "#f8fafc",
    ink: "#0f172a",
    muted: "#64748b",
    accent: "#0284c7",
    panel: "#ffffff",
    swatch: "linear-gradient(135deg, #0369a1, #7dd3fc)",
    dark: false,
  },
  gold: {
    label: "Executive Gold",
    detail: "Gold and navy",
    cover: "linear-gradient(165deg, #1c1917 0%, #44403c 42%, #a16207 100%)",
    screen: "#fffbeb",
    ink: "#1c1917",
    muted: "#78716c",
    accent: "#b45309",
    panel: "#ffffff",
    swatch: "linear-gradient(135deg, #44403c, #eab308)",
    dark: false,
  },
};

/** Bold `**text**` and italic `*text*` without treating the rest as HTML. */
function emphasize(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

type FaceProps = {
  name: string;
  company: string;
  title?: string;
  department?: string;
  biography?: string;
  photoUrl?: string;
  coverUrl?: string;
  backgroundColor?: string;
  accentColor?: string;
  photoFocusX?: number;
  photoFocusY?: number;
  theme?: CardTheme;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  links?: PhoneCardLink[];
  vcardHref?: string;
  onSaveContact?: () => void;
  shareUrl?: string;
  onTrack?: (eventType: string) => void;
  layout?: "screen" | "page";
};

export function DigitalCardFace({
  name,
  company,
  title,
  department,
  biography,
  photoUrl,
  coverUrl,
  backgroundColor,
  accentColor,
  photoFocusX = 50,
  photoFocusY = 50,
  theme = "navy",
  phone,
  email,
  website,
  address,
  links = [],
  vcardHref,
  onSaveContact,
  shareUrl,
  onTrack,
  layout = "screen",
}: FaceProps) {
  const preset = THEME_PRESETS[theme] ?? THEME_PRESETS.navy;
  const custom = backgroundColor ? inkFor(backgroundColor) : null;
  const ink = custom?.ink ?? preset.ink;
  const muted = custom?.muted ?? preset.muted;
  const panel = custom?.panel ?? preset.panel;
  const accent = accentColor || preset.accent;
  const screen = backgroundColor || preset.screen;
  const focus = `${photoFocusX}% ${photoFocusY}%`;
  const initials = initialsOf(name);
  const page = layout === "page";
  return (
    <article className={page ? "min-h-screen" : "min-h-full"} style={{ background: screen, color: ink }}>
      <div className="relative">
        <div data-card-cover className="relative h-36 overflow-hidden" style={{ background: backgroundColor || preset.cover }}>
          {coverUrl ? (
            <img alt="" src={coverUrl} className="absolute inset-0 h-full w-full object-cover object-center" />
          ) : (
            <svg className="absolute inset-x-0 bottom-0 h-20 w-full" viewBox="0 0 320 80" preserveAspectRatio="none" aria-hidden>
              <path d="M0 80V48l48-22 40 16 52-30 48 24 44-22 40 18 48-24v72H0Z" fill="rgba(255,255,255,0.16)" />
              <path d="M0 80V62l70-16 54 12 60-20 70 18 66-14v38H0Z" fill="rgba(0,0,0,0.18)" />
            </svg>
          )}
          <p className="absolute left-4 top-8 text-xs font-semibold tracking-wide text-white">NexCort iQ</p>
        </div>
        <div data-card-avatar className="absolute left-1/2 top-36 z-20 -translate-x-1/2 -translate-y-[38%]">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-2xl font-semibold text-white shadow-lg ring-4 ring-white">
            {photoUrl ? <img alt="" src={photoUrl} className="h-full w-full object-cover" style={{ objectPosition: focus }} /> : initials}
          </div>
        </div>
      </div>
      <div className="px-5 pb-6 pt-[4.75rem]">
        <h2 className="mt-3 text-center text-[1.65rem] font-semibold leading-tight">{name || "Your name"}</h2>
        {title ? <p className="text-center text-sm" style={{ color: muted }}>{title}</p> : null}
        <p className="text-center text-sm font-medium">{company || "NexCort iQ"}</p>
        {department ? <p className="text-center text-xs" style={{ color: muted }}>{department}</p> : null}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <Action href={phone ? `tel:${phone}` : undefined} label="Call" tint="#7c3aed" eventType="call_click" onTrack={onTrack}><PhoneIcon /></Action>
          <Action href={phone ? `sms:${phone}` : undefined} label="Message" tint="#2563eb" eventType="call_click" onTrack={onTrack}><ChatIcon /></Action>
          <Action href={email ? `mailto:${email}` : undefined} label="Email" tint="#059669" eventType="email_click" onTrack={onTrack}><MailIcon /></Action>
          <Action label="Share" tint="#db2777" eventType="share_click" onTrack={onTrack} onPress={shareUrl ? () => void shareCard(shareUrl, name) : undefined}><ShareIcon /></Action>
        </div>
        {biography ? (
          <section className="mt-5 rounded-2xl p-4 shadow-sm" style={{ background: panel }}>
            <h3 className="text-sm font-semibold">About me</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" style={{ color: muted }}>{emphasize(biography)}</p>
          </section>
        ) : null}
        <div className="mt-4 space-y-2">
          {phone ? <Detail icon={<PhoneIcon />} label="Phone" value={phone} href={`tel:${phone}`} eventType="call_click" onTrack={onTrack} panel={panel} muted={muted} /> : null}
          {email ? <Detail icon={<MailIcon />} label="Email" value={email} href={`mailto:${email}`} eventType="email_click" onTrack={onTrack} panel={panel} muted={muted} /> : null}
          {website ? <Detail icon={<GlobeIcon />} label="Website" value={website.replace(/^https?:\/\//, "")} href={website} eventType="web_click" onTrack={onTrack} panel={panel} muted={muted} /> : null}
          {address ? <Detail icon={<PinIcon />} label="Address" value={address} panel={panel} muted={muted} /> : null}
        </div>
        {links.length ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {links.map((link) => (
              <a
                key={`${link.label}-${link.href}`}
                href={link.href}
                aria-label={link.label}
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: accent }}
                onClick={() => link.eventType && onTrack?.(link.eventType)}
              >
                <SocialGlyph name={link.label} />
              </a>
            ))}
          </div>
        ) : null}
        {vcardHref || onSaveContact ? (
          vcardHref ? (
            <a className="mt-5 flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-white" style={{ background: accent }} href={vcardHref} onClick={() => onTrack?.("vcf_download")}>
              Save Contact
            </a>
          ) : (
            <button type="button" className="mt-5 flex min-h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold text-white" style={{ background: accent }} onClick={onSaveContact}>
              Save Contact
            </button>
          )
        ) : null}
        <p className="mt-4 text-center text-[11px]" style={{ color: muted }}>Powered by NexCort iQ</p>
      </div>
    </article>
  );
}

export function SmartphonePreview(props: FaceProps) {
  const [time, setTime] = useState("--:--");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-violet-600/25 blur-3xl" aria-hidden />
      <div className="rounded-[2.9rem] bg-gradient-to-b from-zinc-400 via-zinc-700 to-zinc-950 p-[3px] shadow-[0_30px_80px_rgba(76,29,149,0.35)]">
        <div className="rounded-[2.7rem] bg-zinc-950 p-[10px]">
          <div className="relative overflow-hidden rounded-[2.15rem] bg-black">
            <div className="pointer-events-none absolute left-1/2 top-[9px] z-20 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 pt-2.5 text-[11px] font-semibold text-white">
              <span>{time}</span>
              <span className="pr-1">LTE</span>
            </div>
            <div className="max-h-[min(680px,calc(100vh-8.5rem))] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <DigitalCardFace {...props} layout="screen" />
            </div>
            <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-20 h-1 w-28 -translate-x-1/2 rounded-full bg-white/80" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use SmartphonePreview. Kept so existing imports keep rendering the device. */
export function PhoneCard(props: FaceProps & { background?: CardTheme }) {
  return <SmartphonePreview {...props} theme={props.theme ?? props.background} />;
}

export function SocialGlyph({ name }: { name: string }) {
  const key = name.toLowerCase();
  if (key.includes("linkedin")) return <Glyph path="M6 9h3v9H6zM7.5 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 9h2.8v1.3h.1c.4-.7 1.4-1.5 2.8-1.5 3 0 3.6 2 3.6 4.5V18H18v-4.4c0-1 0-2.4-1.5-2.4s-1.7 1.1-1.7 2.3V18H12V9z" />;
  if (key.includes("instagram")) return <Glyph path="M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4zm8.2 1.8h-1.2V7h1.2V5.8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />;
  if (key === "x" || key.includes("twitter")) return <Glyph path="M5 5l5.2 6.8L5.2 19H7l3.6-4.6L14.2 19H19l-5.5-7.2L18.4 5H16.6l-3.2 4.2L10.2 5H5z" />;
  if (key.includes("youtube")) return <Glyph path="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5v-7zM11 9.5v5l4.5-2.5L11 9.5z" />;
  if (key.includes("tiktok")) return <Glyph path="M14 4v9.2a3.2 3.2 0 1 1-2.2-3V7.2A6.2 6.2 0 0 0 16 8.6V6.2A4.2 4.2 0 0 1 14 4z" />;
  if (key.includes("facebook")) return <Glyph path="M14 9h2V6h-2c-2.2 0-3.5 1.3-3.5 3.4V11H9v3h1.5v6H14v-6h2l.5-3H14V9.6c0-.4.2-.6.6-.6z" />;
  if (key.includes("calendar")) return <Glyph path="M7 4v2M17 4v2M5 8h14M6 6h12a1 1 0 0 1 1 1v11H5V7a1 1 0 0 1 1-1z" />;
  return <GlobeIcon />;
}

function Action({
  href,
  label,
  tint,
  children,
  eventType,
  onTrack,
  onPress,
}: {
  href?: string;
  label: string;
  tint: string;
  children: ReactNode;
  eventType?: string;
  onTrack?: (eventType: string) => void;
  onPress?: () => void;
}) {
  const className = "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold text-white motion-safe:transition motion-safe:active:scale-95";
  const style = { background: tint };
  const inner = (
    <>
      <span className="flex h-5 w-5 items-center justify-center">{children}</span>
      {label}
    </>
  );
  if (href) {
    return (
      <a className={className} style={style} href={href} aria-label={label} onClick={() => eventType && onTrack?.(eventType)}>
        {inner}
      </a>
    );
  }
  if (onPress) {
    return (
      <button type="button" className={className} style={style} aria-label={label} onClick={() => { if (eventType) onTrack?.(eventType); onPress(); }}>
        {inner}
      </button>
    );
  }
  return <span className={`${className} opacity-40`} style={style} aria-hidden>{inner}</span>;
}

function Detail({
  icon,
  label,
  value,
  href,
  eventType,
  onTrack,
  panel,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
  eventType?: string;
  onTrack?: (eventType: string) => void;
  panel: string;
  muted: string;
}) {
  const body = (
    <>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px]" style={{ color: muted }}>{label}</span>
        <span className="block truncate text-sm">{value}</span>
      </span>
    </>
  );
  const className = "flex items-start gap-3 rounded-2xl px-3 py-2.5 shadow-sm";
  if (!href) return <div className={className} style={{ background: panel }}>{body}</div>;
  return (
    <a className={className} style={{ background: panel }} href={href} onClick={() => eventType && onTrack?.(eventType)}>
      {body}
    </a>
  );
}

function inkFor(hex: string): { ink: string; muted: string; panel: string } {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  if (luminance < 0.45) return { ink: "#f8fafc", muted: "#cbd5e1", panel: "rgba(15,23,42,0.72)" };
  return { ink: "#0f172a", muted: "#475569", panel: "#ffffff" };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NC";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

async function shareCard(url: string, title: string) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ url, title });
      return;
    } catch {
      return;
    }
  }
  await navigator.clipboard.writeText(url);
}

function Glyph({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d={path} />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 4h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 6h14v9H8l-3 3z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="6" cy="12" r="2" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="m8 11 7-3M8 13l7 3" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}

"use client";

import type { CampusInfoTabPublic } from "rapid-cortex-shared";
import { ExternalLink, Phone } from "lucide-react";
import { SAFETY_BRAND } from "./safety-reporting/tokens";

/** Minimal safe markdown: escape HTML, **bold**, newlines → <br>. */
function renderMarkdown(src: string): string {
  const escaped = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

export function CampusInfoTabPanel({
  infoTab,
  locationLabel,
  campusAlertsAvailable = false,
  onRegisterCampusAlerts,
}: {
  infoTab: CampusInfoTabPublic;
  locationLabel?: string;
  /** Higher-ed Campus Alerts self-registration (platform + tenant flags). */
  campusAlertsAvailable?: boolean;
  onRegisterCampusAlerts?: () => void;
}) {
  const accent = infoTab.brandColor?.trim() || SAFETY_BRAND.deepBlue;
  const banner = infoTab.alertBanner;

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border bg-white p-5"
        style={{ borderColor: SAFETY_BRAND.border, boxShadow: SAFETY_BRAND.cardShadow }}
      >
        <div className="flex items-center gap-3">
          {infoTab.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={infoTab.logoUrl}
              alt=""
              className="h-12 w-12 object-contain"
              width={48}
              height={48}
            />
          ) : null}
          <div>
            <h2 className="text-lg font-bold tracking-tight" style={{ color: accent }}>
              {infoTab.displayName ?? "Campus information"}
            </h2>
            {locationLabel ? (
              <p className="mt-0.5 text-xs font-medium" style={{ color: SAFETY_BRAND.muted }}>
                {locationLabel}
              </p>
            ) : null}
          </div>
        </div>

        {banner?.active && banner.message ? (
          <div
            className="mt-4 rounded-xl px-3 py-2.5 text-sm font-medium"
            style={{
              backgroundColor:
                banner.severity === "critical"
                  ? "#FEF2F2"
                  : banner.severity === "warning"
                    ? "#FFFBEB"
                    : "#EFF6FF",
              color:
                banner.severity === "critical"
                  ? "#991B1B"
                  : banner.severity === "warning"
                    ? "#92400E"
                    : "#1E40AF",
            }}
            role="status"
          >
            {banner.message}
          </div>
        ) : null}
      </div>

      {campusAlertsAvailable && onRegisterCampusAlerts ? (
        <div
          className="rounded-2xl border bg-white p-5"
          style={{ borderColor: SAFETY_BRAND.border, boxShadow: SAFETY_BRAND.cardShadow }}
        >
          <h3 className="text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            Campus Alerts
          </h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: SAFETY_BRAND.muted }}>
            Receive important emergency notifications, campus safety advisories, and
            university-issued alerts directly on your phone.
          </p>
          <button
            type="button"
            onClick={onRegisterCampusAlerts}
            className="mt-4 min-h-12 w-full rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            Register / Renew Notifications
          </button>
          <ul className="mt-3 space-y-1 text-xs" style={{ color: SAFETY_BRAND.muted }}>
            <li>View Active Campus Alerts (see banner above when published)</li>
            <li>Renew annually here — university email/portal reminders; not mass SMS</li>
            <li>Notification Privacy — optional SMS; STOP anytime</li>
            <li>How to Unsubscribe — reply STOP to any Campus Alerts message</li>
          </ul>
        </div>
      ) : null}

      {(infoTab.emergencyContacts?.length ?? 0) > 0 ? (
        <div
          className="rounded-2xl border bg-white p-5"
          style={{ borderColor: SAFETY_BRAND.border, boxShadow: SAFETY_BRAND.cardShadow }}
        >
          <h3 className="text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            Emergency contacts
          </h3>
          <ul className="mt-3 space-y-2">
            {infoTab.emergencyContacts!.map((c) => (
              <li key={`${c.label}-${c.phone}`}>
                <a
                  href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                  className="flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium"
                  style={{ borderColor: SAFETY_BRAND.border, color: accent }}
                >
                  <Phone className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {c.label}
                    <span className="mt-0.5 block text-xs font-normal" style={{ color: SAFETY_BRAND.muted }}>
                      {c.phone}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(infoTab.sections ?? []).map((s) => (
        <div
          key={`${s.order}-${s.title}`}
          className="rounded-2xl border bg-white p-5"
          style={{ borderColor: SAFETY_BRAND.border, boxShadow: SAFETY_BRAND.cardShadow }}
        >
          <h3 className="text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            {s.title}
          </h3>
          <div
            className="mt-2 text-sm leading-relaxed"
            style={{ color: SAFETY_BRAND.muted }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(s.content) }}
          />
        </div>
      ))}

      {(infoTab.externalLinks?.length ?? 0) > 0 ? (
        <div
          className="rounded-2xl border bg-white p-5"
          style={{ borderColor: SAFETY_BRAND.border, boxShadow: SAFETY_BRAND.cardShadow }}
        >
          <h3 className="text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            More information
          </h3>
          <ul className="mt-3 space-y-2">
            {infoTab.externalLinks!.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-2 hover:underline"
                  style={{ color: accent }}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

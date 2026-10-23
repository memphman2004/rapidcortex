"use client";

import { DigitalCardFace, SmartphonePreview, type PhoneCardLink } from "./phone-card";
import type { CardTheme } from "@/lib/business-cards/form";

type Props = {
  publicProfileId: string;
  vcardHref: string;
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
  address?: string;
  background?: CardTheme;
  phone?: string;
  email?: string;
  website?: string;
  links?: PhoneCardLink[];
  shareUrl: string;
};

function track(publicProfileId: string, eventType: string) {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("src");
  const sourceType = raw === "nfc" || raw === "qr" || raw === "share" ? (raw === "share" ? "shared_link" : raw) : "unknown";
  void fetch(`/api/public/business-cards/${publicProfileId}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, sourceType }),
  }).catch(() => undefined);
}

export function PublicCardActions(props: Props) {
  const face = {
    name: props.name,
    company: props.company,
    title: props.title,
    department: props.department,
    biography: props.biography,
    photoUrl: props.photoUrl,
    coverUrl: props.coverUrl,
    backgroundColor: props.backgroundColor,
    accentColor: props.accentColor,
    photoFocusX: props.photoFocusX,
    photoFocusY: props.photoFocusY,
    theme: props.background,
    phone: props.phone,
    email: props.email,
    website: props.website,
    address: props.address,
    links: props.links,
    vcardHref: props.vcardHref,
    shareUrl: props.shareUrl,
    onTrack: (eventType: string) => track(props.publicProfileId, eventType),
  };
  return (
    <>
      <div className="md:hidden">
        <DigitalCardFace {...face} layout="page" />
      </div>
      <div className="hidden md:block">
        <SmartphonePreview {...face} />
      </div>
    </>
  );
}

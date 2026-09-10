"use client";

import { useParams } from "next/navigation";
import { TranslateHomeClient } from "@/components/translate/TranslateHomeClient";

export default function VenueConsoleTranslatePage() {
  const params = useParams<{ venueCode: string }>();
  const code = params.venueCode;
  return (
    <TranslateHomeClient
      vertical="venue"
      heading="RC Translate"
      venueCode={code}
      sessionHref={(id) => `/venue/${code}/translate/${id}`}
    />
  );
}

"use client";

import { useParams } from "next/navigation";
import { TranslateHomeClient } from "@/components/translate/TranslateHomeClient";

export default function VenueTranslatePage() {
  const params = useParams<{ venueCode: string }>();
  const code = params.venueCode;
  return (
    <TranslateHomeClient
      vertical="venue"
      heading="RC Translate"
      venueCode={code}
      sessionHref={(id) => `/app/venue/${code}/translate/${id}`}
    />
  );
}

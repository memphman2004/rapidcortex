"use client";

import { useParams } from "next/navigation";
import { TranslateHomeClient } from "@/components/translate/TranslateHomeClient";

export default function TransitTranslatePage() {
  const params = useParams<{ transitCode: string }>();
  const code = params.transitCode;
  return (
    <TranslateHomeClient
      vertical="venue"
      heading="Translate"
      venueCode={code}
      sessionHref={(id) => `/transit/${code}/translate/${id}`}
    />
  );
}

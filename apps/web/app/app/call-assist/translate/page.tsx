"use client";

import { TranslateHomeClient } from "@/components/translate/TranslateHomeClient";

export default function CallAssistTranslatePage() {
  return (
    <TranslateHomeClient
      vertical="law_enforcement"
      heading="Translate"
      sessionHref={(id) => `/app/call-assist/translate/${id}`}
    />
  );
}

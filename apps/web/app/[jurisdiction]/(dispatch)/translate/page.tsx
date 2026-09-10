"use client";

import { useParams } from "next/navigation";
import { TranslateHomeClient } from "@/components/translate/TranslateHomeClient";

export default function TranslateIndexPage() {
  const params = useParams<{ jurisdiction: string }>();
  const jurisdiction = params.jurisdiction;
  return (
    <TranslateHomeClient
      vertical="law_enforcement"
      heading="RC Translate"
      sessionHref={(id) => `/${jurisdiction}/translate/${id}`}
    />
  );
}

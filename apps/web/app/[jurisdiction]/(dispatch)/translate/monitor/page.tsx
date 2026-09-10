"use client";

import { useParams } from "next/navigation";
import { DispatchTranslateMonitor } from "@/components/translate/DispatchTranslateMonitor";

export default function TranslateMonitorPage() {
  const params = useParams<{ jurisdiction: string }>();
  return <DispatchTranslateMonitor jurisdiction={params.jurisdiction} />;
}

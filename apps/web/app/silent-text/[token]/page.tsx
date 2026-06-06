import type { Metadata } from "next";
import { SilentTextCallerClient } from "@/components/silent-text/silent-text-caller-client";

export const metadata: Metadata = {
  title: "Silent Text — Rapid Cortex",
  robots: { index: false, follow: false },
};

export default async function SilentTextTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SilentTextCallerClient token={token} />;
}

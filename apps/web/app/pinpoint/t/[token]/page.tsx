import type { Metadata } from "next";
import { PinpointCallerClient } from "@/components/pinpoint/pinpoint-caller-client";

export const metadata: Metadata = {
  title: "Share location — LiveLocation · Rapid Cortex",
  robots: { index: false, follow: false },
};

export default async function PinpointTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PinpointCallerClient token={token} />;
}

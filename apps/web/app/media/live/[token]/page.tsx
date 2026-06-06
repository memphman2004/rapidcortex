import type { Metadata } from "next";
import { LiveVideoCallerClient } from "@/components/live-video/live-video-caller-client";

export const metadata: Metadata = {
  title: "Rapid Cortex Live Video",
  robots: { index: false, follow: false },
};

export default async function MediaLiveTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <LiveVideoCallerClient token={token} />;
}

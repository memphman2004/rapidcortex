import type { Metadata } from "next";
import { VideoAssistCallerClient } from "@/components/video-assist/video-assist-caller-client";

export const metadata: Metadata = {
  title: "Caller Video Assist",
  robots: { index: false, follow: false },
};

export default async function VideoAssistTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <VideoAssistCallerClient token={token} />;
}

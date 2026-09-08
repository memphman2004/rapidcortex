"use client";

import { useParams } from "next/navigation";
import { useSession } from "@/components/auth/session-context";
import { CallAssistSessionDetail } from "@/components/call-assist/call-assist-session-detail";
import { canViewCallAssist } from "@/lib/call-assist/access";

export default function CallAssistSessionPage() {
  const { user } = useSession();
  const params = useParams<{ sessionId: string }>();
  if (!user) return null;
  if (!canViewCallAssist(user.role)) {
    return <p className="p-6 text-sm text-rose-300">You do not have permission to view Call Assist.</p>;
  }
  return <CallAssistSessionDetail sessionId={params.sessionId} />;
}

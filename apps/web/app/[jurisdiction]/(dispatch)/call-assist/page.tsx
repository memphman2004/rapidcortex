"use client";

import { useSession } from "@/components/auth/session-context";
import { CallAssistMonitor } from "@/components/call-assist/call-assist-monitor";
import { canViewCallAssist } from "@/lib/call-assist/access";

export default function CallAssistMonitorPage() {
  const { user } = useSession();
  if (!user) return null;
  return <CallAssistMonitor canView={canViewCallAssist(user.role)} />;
}

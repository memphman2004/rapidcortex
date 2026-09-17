"use client";

import { useSession } from "@/components/auth/session-context";
import { CallAssistMonitor } from "@/components/call-assist/call-assist-monitor";
import { canViewCallAssist } from "@/lib/call-assist/access";

export function CallAssistOperatorHome() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <CallAssistMonitor
      canView={canViewCallAssist(user.role)}
      variant="operator"
      title="Live non-emergency calls"
      description="Operator workspace: live Call Assist sessions, takeover, and transfer. This is not a 911 telecommunicator console — no CAD queue, incident table, or dispatcher tools."
    />
  );
}

export function CallAssistSupervisorHome() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <CallAssistMonitor
      canView={canViewCallAssist(user.role)}
      variant="supervisor"
      title="Supervisor workspace"
      description="Live non-emergency sessions plus QA and analytics. No 911 supervisor workspace, CAD approval queue, or agency-admin configuration."
    />
  );
}

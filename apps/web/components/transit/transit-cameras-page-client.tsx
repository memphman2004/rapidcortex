"use client";

import { TransitOperationsShell } from "./transit-operations-shell";
import { TransitSettingsCamerasPanel } from "./transit-settings-panels";
import { useTransitOpsData } from "./use-transit-ops-data";
import { T } from "./transit-theme";

export function TransitCamerasPageClient(props: {
  agencyId: string;
  transitCode: string;
  transitName: string;
  userEmail: string;
  userRole: string;
  userId: string;
}) {
  const ops = useTransitOpsData(props.agencyId);
  const linkBase = `/transit/${props.transitCode}`;

  return (
    <TransitOperationsShell
      transitName={props.transitName}
      linkBase={linkBase}
      userEmail={props.userEmail}
      userRole={props.userRole}
      agencyId={props.agencyId}
      userId={props.userId}
      alertLevel={ops.data?.alert.level ?? "nominal"}
    >
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 11, color: T.textSecondary, margin: "0 0 12px" }}>
          Not a 911 PSAP console. Transit operations only.
        </p>
        <h1 style={{ margin: "0 0 16px", fontSize: 20, color: T.textPrimary }}>Cameras</h1>
        <TransitSettingsCamerasPanel
          agencyId={props.agencyId}
          transitCode={props.transitCode}
          userRole={props.userRole}
          vehicles={ops.data?.vehicles ?? []}
        />
      </div>
    </TransitOperationsShell>
  );
}

"use client";

import { Suspense } from "react";
import { VideoWallClient } from "@/components/video/video-wall-client";
import { TransitOperationsShell } from "./transit-operations-shell";
import { T } from "./transit-theme";

export function TransitVideoWallPageClient(props: {
  agencyId: string;
  transitCode: string;
  transitName: string;
  userEmail: string;
  userRole: string;
  userId: string;
}) {
  const linkBase = `/transit/${props.transitCode}`;

  return (
    <TransitOperationsShell
      transitName={props.transitName}
      linkBase={linkBase}
      userEmail={props.userEmail}
      userRole={props.userRole}
      agencyId={props.agencyId}
      userId={props.userId}
    >
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 11, color: T.textSecondary, margin: "0 0 12px" }}>
          Not a 911 PSAP console. Transit operations only.
        </p>
        <Suspense fallback={<p style={{ color: T.textSecondary, fontSize: 13 }}>Loading video wall…</p>}>
          <VideoWallClient agencyId={props.agencyId} apiVertical="transit" />
        </Suspense>
      </div>
    </TransitOperationsShell>
  );
}

import { Suspense } from "react";
import { StaffGuidePortal } from "./staff-guide-portal";
import type { StaffGuideVertical } from "@/lib/staff-guide/catalog";

function PortalFallback() {
  return (
    <p className="text-sm" style={{ color: "var(--rc-text-muted)" }}>
      Loading staff guide…
    </p>
  );
}

export function StaffGuideView(props: {
  vertical: StaffGuideVertical;
  role: string;
  basePath: string;
}) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <StaffGuidePortal {...props} />
    </Suspense>
  );
}

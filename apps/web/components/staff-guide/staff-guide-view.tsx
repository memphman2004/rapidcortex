import { Suspense } from "react";
import { StaffGuidePortal } from "./staff-guide-portal";
import type { StaffGuideVertical } from "@/lib/staff-guide/catalog";
import { loadStaffGuideArticles } from "@/lib/staff-guide/load-articles";

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
  const articles = loadStaffGuideArticles(props.vertical);
  return (
    <Suspense fallback={<PortalFallback />}>
      <StaffGuidePortal {...props} articles={articles} />
    </Suspense>
  );
}

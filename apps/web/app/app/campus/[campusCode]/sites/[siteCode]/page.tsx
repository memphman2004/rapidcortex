import { redirect } from "next/navigation";
import Link from "next/link";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { SchoolSiteDetailClient } from "./school-site-detail-client";

export default async function CampusSiteDetailPage({
  params,
}: {
  params: Promise<{ campusCode: string; siteCode: string }>;
}) {
  const { campusCode, siteCode } = await params;
  const user = await getDashboardSessionUser();
  const code = campusCode.toUpperCase();
  const school = decodeURIComponent(siteCode).toUpperCase();
  if (!user) redirect(`/login?from=/app/campus/${encodeURIComponent(code)}/sites/${school}`);
  if (!user.agencyId) redirect(`/app/campus/${encodeURIComponent(code)}`);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href={`/app/campus/${code}/sites`}
          style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 600, textDecoration: "none" }}
        >
          ← District schools
        </Link>
      </div>
      <SchoolSiteDetailClient
        agencyId={user.agencyId}
        campusCode={code}
        siteCode={school}
      />
    </div>
  );
}

import { CampusCamerasClient } from "./campus-cameras-client";

export default async function CampusCamerasPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  return <CampusCamerasClient campusCode={campusCode} />;
}

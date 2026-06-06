import type { Metadata } from "next";
import { VenueDashboardClient } from "./dashboard-client";

type VenueDashboardParams = { venueCode: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<VenueDashboardParams>;
}): Promise<Metadata> {
  const { venueCode } = await params;
  return {
    title: `${venueCode} Operations | Rapid Cortex Venue`,
  };
}

export default async function VenueDashboardPage({
  params,
}: {
  params: Promise<VenueDashboardParams>;
}) {
  const { venueCode } = await params;
  return <VenueDashboardClient venueCode={venueCode} />;
}

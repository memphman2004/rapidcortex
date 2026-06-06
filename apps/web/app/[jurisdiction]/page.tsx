import { notFound, redirect } from "next/navigation";
import { isReservedPublicJurisdictionSlug } from "@/lib/reserved-public-route-segments";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function JurisdictionRootPage({ params }: Props) {
  const { jurisdiction } = await params;
  if (isReservedPublicJurisdictionSlug(jurisdiction)) {
    notFound();
  }
  redirect(`/${jurisdiction}/dashboard`);
}

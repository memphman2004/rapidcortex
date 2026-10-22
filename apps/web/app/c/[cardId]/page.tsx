import { redirect } from "next/navigation";

export default async function NfcCardPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const base = process.env.API_UPSTREAM_BASE?.replace(/\/$/, "");
  if (!base) redirect("/c/inactive");
  const response = await fetch(`${base}/api/public/c/${encodeURIComponent(cardId)}`, {
    redirect: "manual",
    cache: "no-store",
  });
  const location = response.headers.get("location");
  redirect(location || "/c/inactive");
}

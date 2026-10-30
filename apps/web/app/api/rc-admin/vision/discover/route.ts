import { NextResponse } from "next/server";
import { isRcStaff } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import {
  discoverySourceAllowed,
  licenseAllowsTraining,
  type DiscoveryCandidate,
} from "@/lib/rapid-vision/model-studio";

export const dynamic = "force-dynamic";

const SUGGESTED: Record<string, string[]> = {
  firearm_like: ["handgun product photo", "tool that resembles a handgun", "phone held like an object"],
  blade_like: ["utility knife", "kitchen utensil", "box cutter"],
  altercation: ["physical altercation dataset", "contact sport", "people exercising"],
  person_down: ["person lying down", "person stretching on floor"],
  vehicle_collision: ["vehicle collision dataset", "parked cars"],
  transit_hazard: ["railway platform", "person on train platform"],
  smoke_or_flame: ["visible smoke", "stage flame effect"],
};

type OpenverseHit = {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  license?: string;
  creator?: string;
  foreign_landing_url?: string;
};

async function searchOpenverse(query: string, limit: number, kind: "images" | "audio"): Promise<DiscoveryCandidate[]> {
  const endpoint = new URL(`https://api.openverse.org/v1/${kind}/`);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("page_size", String(limit));
  const response = await fetch(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) return [];
  const body = (await response.json()) as { results?: OpenverseHit[] };
  return (body.results ?? []).map((hit) => {
    const license = hit.license ?? "";
    const trainable = licenseAllowsTraining(license);
    return {
      id: `openverse-${hit.id ?? hit.url ?? hit.title}`,
      title: hit.title || "Untitled",
      mediaType: "image" as const,
      source: "openverse" as const,
      sourceUrl: hit.foreign_landing_url || hit.url || "https://openverse.org",
      previewUrl: hit.thumbnail || null,
      creator: hit.creator || "Unlisted creator",
      license: license || "unspecified",
      trainable,
      review: "pending" as const,
    };
  });
}

async function searchWikimedia(query: string, limit: number): Promise<DiscoveryCandidate[]> {
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  endpoint.searchParams.set("generator", "search");
  endpoint.searchParams.set("gsrnamespace", "6");
  endpoint.searchParams.set("gsrlimit", String(limit));
  endpoint.searchParams.set("gsrsearch", query);
  endpoint.searchParams.set("prop", "info");
  endpoint.searchParams.set("inprop", "url");
  const response = await fetch(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) return [];
  const body = (await response.json()) as { query?: { pages?: Record<string, { title?: string; fullurl?: string; pageid?: number }> } };
  return Object.values(body.query?.pages ?? {}).map((page) => ({
    id: `wikimedia-${page.pageid ?? page.title}`,
    title: page.title || "Commons file",
    mediaType: "image" as const,
    source: "wikimedia" as const,
    sourceUrl: page.fullurl || "https://commons.wikimedia.org",
    previewUrl: null,
    creator: "See the Commons file page",
    license: "unspecified",
    trainable: false,
    review: "pending" as const,
  }));
}

async function searchHuggingFace(query: string, limit: number): Promise<DiscoveryCandidate[]> {
  const endpoint = new URL("https://huggingface.co/api/datasets");
  endpoint.searchParams.set("search", query);
  endpoint.searchParams.set("limit", String(limit));
  const response = await fetch(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) return [];
  const body = (await response.json()) as Array<{ id?: string; author?: string }>;
  return body.slice(0, limit).map((row) => ({
    id: `hf-${row.id}`,
    title: row.id || "Dataset",
    mediaType: "dataset" as const,
    source: "huggingface" as const,
    sourceUrl: `https://huggingface.co/datasets/${row.id}`,
    previewUrl: null,
    creator: row.author || "Hugging Face",
    license: "unspecified",
    trainable: false,
    review: "pending" as const,
  }));
}

export async function POST(request: Request) {
  const user = await getDashboardSessionUser();
  if (!user || !isRcStaff(user.role)) {
    return NextResponse.json({ error: "Only RC Admin, RC IT, and RC Superadmin can run discovery." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    category?: string;
    query?: string;
    source?: string;
    limit?: number;
    media?: string;
  } | null;
  const source = body?.source ?? "openverse";
  if (!discoverySourceAllowed(source)) {
    return NextResponse.json({ error: "That source is not approved. YouTube downloads and open web crawls are not available." }, { status: 400 });
  }
  if (body?.media === "text") {
    return NextResponse.json({
      candidates: [],
      notice: "Public text search is not connected. A written post is not visual training data and cannot open a Scene Incident.",
    });
  }
  const category = body?.category || "firearm_like";
  const query = (body?.query || SUGGESTED[category]?.[0] || category).slice(0, 160);
  const limit = Math.min(20, Math.max(1, Number(body?.limit) || 12));
  try {
    const candidates =
      source === "wikimedia"
        ? await searchWikimedia(query, limit)
        : source === "huggingface"
          ? await searchHuggingFace(query, limit)
          : await searchOpenverse(query, limit, "images");
    return NextResponse.json({
      candidates,
      query,
      suggested: SUGGESTED[category] ?? [],
      notice: "Candidates only. License metadata must be checked. Nothing here was copied into a training dataset or sent to a live camera.",
    });
  } catch {
    return NextResponse.json({ error: "The discovery source did not respond. No files were downloaded." }, { status: 502 });
  }
}

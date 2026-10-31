import { NextResponse } from "next/server";
import { isRcStaff } from "rapid-cortex-security";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import {
  DISCOVERY_SUGGESTIONS,
  STUDIO_CATEGORIES,
  candidateFromHuggingFace,
  candidateFromInternetArchive,
  candidateFromOpenverse,
  candidateFromWikimediaPage,
  discoverySourceRefusal,
  exampleRoleForQuery,
  titleMatchesDiscoveryFilter,
  uniqueDiscoveryCandidates,
  withinMediaBounds,
  type DiscoveryCandidate,
  type StudioCategoryId,
} from "@/lib/rapid-vision/model-studio";

export const dynamic = "force-dynamic";

const SOURCE_HEADERS = {
  accept: "application/json",
  "user-agent": "NexCortiQModelStudio/1.0 (https://www.nexcortiq.us)",
};

type SearchResult = { candidates: DiscoveryCandidate[]; warning: string | null };

function knownCategory(value: string | undefined): StudioCategoryId {
  const match = STUDIO_CATEGORIES.find((category) => category.id === value);
  return match?.id ?? "firearm_like";
}

async function searchOpenverse(query: string, limit: number): Promise<SearchResult> {
  const endpoint = new URL("https://api.openverse.org/v1/images/");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("page_size", String(limit));
  endpoint.searchParams.set("mature", "false");
  try {
    const response = await fetch(endpoint, { headers: SOURCE_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return { candidates: [], warning: "Openverse returned an error. No files were downloaded." };
    const body = (await response.json()) as { results?: Parameters<typeof candidateFromOpenverse>[0][] };
    const candidates = (body.results ?? []).flatMap((hit) => {
      const candidate = candidateFromOpenverse(hit);
      return candidate ? [candidate] : [];
    });
    return { candidates, warning: null };
  } catch {
    return { candidates: [], warning: "Openverse did not respond. No files were downloaded." };
  }
}

async function searchWikimedia(query: string, limit: number, media: "image" | "video"): Promise<SearchResult> {
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  endpoint.searchParams.set("generator", "search");
  endpoint.searchParams.set("gsrnamespace", "6");
  endpoint.searchParams.set("gsrlimit", String(limit));
  endpoint.searchParams.set("gsrsearch", `${query} filetype:${media === "video" ? "video" : "bitmap"}`);
  endpoint.searchParams.set("prop", "imageinfo");
  endpoint.searchParams.set("iiprop", "url|size|mime|extmetadata");
  endpoint.searchParams.set("iiurlwidth", "480");
  try {
    const response = await fetch(endpoint, { headers: SOURCE_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return { candidates: [], warning: "Wikimedia Commons returned an error. No files were downloaded." };
    const body = (await response.json()) as {
      query?: { pages?: Record<string, Parameters<typeof candidateFromWikimediaPage>[0]> };
    };
    const candidates = Object.values(body.query?.pages ?? {}).flatMap((page) => {
      const candidate = candidateFromWikimediaPage(page, { media });
      return candidate ? [candidate] : [];
    });
    return { candidates, warning: null };
  } catch {
    return { candidates: [], warning: "Wikimedia Commons did not respond. No files were downloaded." };
  }
}

async function searchInternetArchive(query: string, limit: number): Promise<SearchResult> {
  const safe = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!safe) return { candidates: [], warning: "The Internet Archive query was empty. No files were downloaded." };
  const endpoint = new URL("https://archive.org/advancedsearch.php");
  endpoint.searchParams.set("q", `mediatype:movies AND (${safe})`);
  endpoint.searchParams.append("fl[]", "identifier");
  endpoint.searchParams.append("fl[]", "title");
  endpoint.searchParams.append("fl[]", "description");
  endpoint.searchParams.append("fl[]", "creator");
  endpoint.searchParams.append("fl[]", "licenseurl");
  endpoint.searchParams.set("output", "json");
  endpoint.searchParams.set("rows", String(limit));
  try {
    const response = await fetch(endpoint, { headers: SOURCE_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return { candidates: [], warning: "Internet Archive returned an error. No files were downloaded." };
    const body = (await response.json()) as { response?: { docs?: Parameters<typeof candidateFromInternetArchive>[0][] } };
    const candidates = (body.response?.docs ?? []).flatMap((doc) => {
      const candidate = candidateFromInternetArchive(doc);
      return candidate ? [candidate] : [];
    });
    return { candidates, warning: "Internet Archive results are metadata and source links. No file was downloaded." };
  } catch {
    return { candidates: [], warning: "Internet Archive did not respond. No files were downloaded." };
  }
}

async function searchHuggingFace(query: string, limit: number): Promise<SearchResult> {
  const endpoint = new URL("https://huggingface.co/api/datasets");
  endpoint.searchParams.set("search", query);
  endpoint.searchParams.set("limit", String(limit));
  try {
    const response = await fetch(endpoint, { headers: SOURCE_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return { candidates: [], warning: "Hugging Face returned an error. No files were downloaded." };
    const body = (await response.json()) as Parameters<typeof candidateFromHuggingFace>[0][];
    const candidates = (Array.isArray(body) ? body : []).slice(0, limit).flatMap((row) => {
      const candidate = candidateFromHuggingFace(row);
      return candidate ? [candidate] : [];
    });
    return { candidates, warning: null };
  } catch {
    return { candidates: [], warning: "Hugging Face did not respond. No files were downloaded." };
  }
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
    environment?: string;
    lighting?: string;
    minDuration?: number;
    minWidth?: number;
  } | null;
  const source = body?.source ?? "openverse";
  const refusal = discoverySourceRefusal(source);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 400 });
  const category = knownCategory(body?.category);
  const suggested = [...DISCOVERY_SUGGESTIONS[category]];
  if (body?.media === "text") {
    return NextResponse.json({
      candidates: [],
      query: "",
      suggested,
      notice: "Public text search is not connected. A written post is not visual training data and cannot open a Scene Incident.",
    });
  }
  const requested = (body?.query ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const query = requested || suggested[0] || category;
  const limit = Math.min(20, Math.max(1, Number(body?.limit) || 12));
  const media = body?.media === "video" ? "video" : body?.media === "dataset" ? "dataset" : "image";
  if (media === "video" && source === "openverse") {
    return NextResponse.json({
      candidates: [],
      query,
      suggested,
      notice: "Openverse is a still-image source. Choose Wikimedia Commons, Internet Archive, or Hugging Face for video. No file was downloaded.",
    });
  }
  const resolvedSource = media === "dataset" ? "huggingface" : source;
  const result =
    resolvedSource === "wikimedia"
      ? await searchWikimedia(query, limit, media === "video" ? "video" : "image")
      : resolvedSource === "huggingface"
        ? await searchHuggingFace(query, limit)
        : resolvedSource === "internetarchive"
          ? await searchInternetArchive(query, limit)
          : await searchOpenverse(query, limit);
  const role = exampleRoleForQuery(category, query);
  const stamped = result.candidates.map((candidate) => ({ ...candidate, exampleRole: role }));
  const filtered = media === "video" && resolvedSource === "huggingface"
    ? stamped.filter((candidate) => candidate.hasVideo)
    : stamped;
  const environment = (body?.environment ?? "").slice(0, 40);
  const lighting = (body?.lighting ?? "").slice(0, 40);
  const minDuration = Number(body?.minDuration) || 0;
  const minWidth = Number(body?.minWidth) || 0;
  const bounded = filtered.map((candidate) => ({ candidate, bound: withinMediaBounds(candidate, { minDuration, minWidth }) }));
  const missingBounds = bounded.filter((item) => item.bound === "missing").length;
  const postFiltered = bounded
    .filter((item) => item.bound === "keep")
    .map((item) => item.candidate)
    .filter((candidate) => titleMatchesDiscoveryFilter(candidate.title, { environment, lighting }));
  const candidates = uniqueDiscoveryCandidates(postFiltered);
  const eligible = candidates.filter((candidate) => candidate.trainable).length;
  const filterNote = environment || lighting
    ? "Environment and lighting were matched against titles after the search. The provider did not filter on them."
    : null;
  const boundsNote = missingBounds > 0
    ? `${missingBounds} file${missingBounds === 1 ? "" : "s"} had no duration or resolution, so they were left out of that filter instead of being guessed.`
    : null;
  const videoDrop = media === "video" && resolvedSource === "huggingface" && stamped.length > 0 && filtered.length === 0
    ? "None of the dataset cards on this page were marked as video."
    : null;
  const notice = [
    result.warning,
    videoDrop,
    boundsNote,
    filterNote,
    candidates.length === 0
      ? "No usable candidates. Nothing was copied into a training dataset."
      : `${eligible} of ${candidates.length} can be reviewed. A license check is not an import, and nothing was sent to a live camera.`,
  ].filter(Boolean).join(" ");
  return NextResponse.json({ candidates, query, suggested, notice });
}

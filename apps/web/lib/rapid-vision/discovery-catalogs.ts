import {
  acceptedDiscoveryUrl,
  licenseAllowsTraining,
  plainDiscoveryText,
  sceneFitForText,
  type DiscoveryCandidate,
} from "./model-studio";

export type CatalogSearchResult = { candidates: DiscoveryCandidate[]; warning: string | null };

const HEADERS = {
  accept: "application/json",
  "user-agent": "NexCortiQModelStudio/1.0 (https://www.nexcortiq.us)",
};

function hostedUrl(url: string | undefined | null, hosts: string[]): string | null {
  const accepted = acceptedDiscoveryUrl(url);
  if (!accepted) return null;
  const host = new URL(accepted).hostname.toLowerCase();
  if (!hosts.some((item) => host === item || host.endsWith(`.${item}`))) return null;
  return accepted.split("#")[0] ?? accepted;
}

function safeQuery(query: string): string {
  return query.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function readJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function finish(input: {
  id: string;
  title: string;
  mediaType: DiscoveryCandidate["mediaType"];
  source: DiscoveryCandidate["source"];
  sourceUrl: string | null;
  previewUrl: string | null;
  creator: string;
  license: string;
  width?: number | null;
  height?: number | null;
  attribution?: string | null;
  hasVideo?: boolean;
}): DiscoveryCandidate | null {
  if (!input.sourceUrl) return null;
  const title = plainDiscoveryText(input.title).slice(0, 180) || "Untitled";
  const fit = sceneFitForText(`${title}`, input.mediaType);
  return {
    id: input.id.slice(0, 180),
    title,
    mediaType: input.mediaType,
    source: input.source,
    sourceUrl: input.sourceUrl,
    previewUrl: input.previewUrl,
    playbackUrl: null,
    creator: plainDiscoveryText(input.creator).slice(0, 180) || "Unlisted creator",
    license: plainDiscoveryText(input.license).slice(0, 160) || "unspecified",
    trainable: licenseAllowsTraining(input.license),
    review: "pending",
    width: input.width ?? null,
    height: input.height ?? null,
    durationSeconds: null,
    attribution: input.attribution ? plainDiscoveryText(input.attribution).slice(0, 240) : null,
    hasVideo: Boolean(input.hasVideo),
    exampleRole: "unspecified",
    ...fit,
  };
}

export function candidateFromLibraryOfCongress(item: {
  id?: string;
  title?: string;
  url?: string;
  contributor?: string[];
  image_url?: string[];
  online_format?: string[];
  item?: { rights_advisory?: string; rights_information?: string };
}, media: "image" | "video"): DiscoveryCandidate | null {
  const formats = (item.online_format ?? []).map((value) => value.toLowerCase());
  const video = formats.some((value) => value.includes("video") || value.includes("film"));
  if (media === "video") {
    if (formats.length > 0 && !video) return null;
  } else if (formats.length > 0 && !formats.includes("image")) {
    return null;
  }
  const sourceUrl = hostedUrl(item.url, ["loc.gov"]);
  const advisory = item.item?.rights_advisory || item.item?.rights_information || "";
  const lower = advisory.toLowerCase();
  const license = /public domain|no copyright|not copyrighted/.test(lower) && !/no known restrictions/.test(lower)
    ? "Public domain"
    : advisory || "unspecified";
  const preview = (item.image_url ?? []).map((url) => hostedUrl(url, ["loc.gov"])).find(Boolean) ?? null;
  const id = (item.id ?? sourceUrl ?? "").replace(/[^\w.-]+/g, "-").slice(-80);
  return finish({
    id: `loc-${id || "item"}`,
    title: item.title ?? "",
    mediaType: media === "video" ? "video" : "image",
    source: "loc",
    sourceUrl,
    previewUrl: preview,
    creator: (item.contributor ?? []).slice(0, 3).join(", "),
    license,
    hasVideo: media === "video",
  });
}

export function candidateFromNasa(item: {
  data?: Array<{ nasa_id?: string; title?: string; description?: string; media_type?: string; center?: string }>;
  links?: Array<{ href?: string; rel?: string }>;
}): DiscoveryCandidate | null {
  const data = item.data?.[0];
  const nasaId = (data?.nasa_id ?? "").trim();
  if (!nasaId || nasaId.length > 180) return null;
  const sourceUrl = hostedUrl(`https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`, ["images.nasa.gov"]);
  const description = data?.description ?? "";
  const lower = description.toLowerCase();
  const license = /copyright|all rights reserved/.test(lower) && !/not copyrighted|no copyright/.test(lower)
    ? "unspecified"
    : /public domain|not copyrighted|not subject to copyright/.test(lower)
      ? "Public domain"
      : "unspecified";
  const preview = (item.links ?? []).map((link) => hostedUrl(link.href, ["nasa.gov"])).find(Boolean) ?? null;
  const video = (data?.media_type ?? "").toLowerCase() === "video";
  return finish({
    id: `nasa-${nasaId.replace(/[^\w.-]+/g, "-")}`,
    title: data?.title ?? nasaId,
    mediaType: video ? "video" : "image",
    source: "nasa",
    sourceUrl,
    previewUrl: preview,
    creator: data?.center ? `NASA ${data.center}` : "NASA",
    license,
    hasVideo: video,
  });
}

export function candidateFromWellcome(image: {
  id?: string;
  source?: { title?: string };
  locations?: Array<{ license?: { label?: string }; credit?: string; url?: string }>;
}): DiscoveryCandidate | null {
  const id = (image.id ?? "").trim();
  if (!/^[\w-]+$/.test(id)) return null;
  const location = image.locations?.[0];
  const license = location?.license?.label || "unspecified";
  const iiif = hostedUrl(location?.url, ["wellcomecollection.org"]);
  const preview = iiif?.endsWith("/info.json") ? iiif.replace(/\/info\.json$/, "/full/480,/0/default.jpg") : null;
  return finish({
    id: `wellcome-${id}`,
    title: image.source?.title ?? id,
    mediaType: "image",
    source: "wellcome",
    sourceUrl: hostedUrl(`https://wellcomecollection.org/images/${id}`, ["wellcomecollection.org"]),
    previewUrl: licenseAllowsTraining(license) ? preview : null,
    creator: location?.credit || "Wellcome Collection",
    license,
    attribution: location?.credit || "Wellcome Collection",
  });
}

export function candidateFromCleveland(row: {
  id?: number;
  title?: string;
  url?: string;
  share_license_status?: string;
  images?: { web?: { url?: string; width?: string; height?: string } };
}): DiscoveryCandidate | null {
  const license = row.share_license_status || "unspecified";
  const width = Number(row.images?.web?.width);
  const height = Number(row.images?.web?.height);
  return finish({
    id: `cleveland-${row.id ?? "item"}`,
    title: row.title ?? "",
    mediaType: "image",
    source: "cleveland",
    sourceUrl: hostedUrl(row.url, ["clevelandart.org"]),
    previewUrl: licenseAllowsTraining(license) ? hostedUrl(row.images?.web?.url, ["clevelandart.org"]) : null,
    creator: "Cleveland Museum of Art",
    license,
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
    attribution: "Cleveland Museum of Art",
  });
}

export function candidateFromArtic(row: {
  id?: number;
  title?: string;
  artist_display?: string;
  image_id?: string;
  is_public_domain?: boolean;
}): DiscoveryCandidate | null {
  if (!row.id) return null;
  const license = row.is_public_domain ? "Public domain" : "restricted";
  const imageId = (row.image_id ?? "").trim();
  const preview = row.is_public_domain && /^[\w-]+$/.test(imageId)
    ? hostedUrl(`https://www.artic.edu/iiif/2/${imageId}/full/843,/0/default.jpg`, ["artic.edu"])
    : null;
  const creator = (row.artist_display ?? "").split("\n")[0] ?? "";
  return finish({
    id: `artic-${row.id}`,
    title: row.title ?? "",
    mediaType: "image",
    source: "artic",
    sourceUrl: hostedUrl(`https://www.artic.edu/artworks/${row.id}`, ["artic.edu"]),
    previewUrl: preview,
    creator,
    license,
    attribution: "Art Institute of Chicago",
  });
}

export function candidateFromSmk(item: {
  id?: string;
  titles?: Array<{ title?: string }>;
  artist?: string[];
  public_domain?: boolean;
  frontend_url?: string;
}): DiscoveryCandidate | null {
  const id = (item.id ?? "").trim();
  if (!/^[\w-]+$/.test(id)) return null;
  return finish({
    id: `smk-${id}`,
    title: item.titles?.[0]?.title ?? id,
    mediaType: "image",
    source: "smk",
    sourceUrl: hostedUrl(item.frontend_url, ["open.smk.dk"]),
    previewUrl: null,
    creator: item.artist?.[0] ?? "SMK",
    license: item.public_domain ? "Public domain" : "unspecified",
    attribution: "SMK — National Gallery of Denmark",
  });
}

export function candidateFromFinna(record: {
  id?: string;
  title?: string;
  images?: string[];
  imageRights?: { copyright?: string };
  nonPresenterAuthors?: Array<{ name?: string }>;
}): DiscoveryCandidate | null {
  const id = (record.id ?? "").trim();
  if (!/^[\w.-]+$/.test(id) || id.includes("..")) return null;
  const cover = record.images?.[0];
  const preview = cover?.startsWith("/Cover/") && !cover.includes("..")
    ? hostedUrl(`https://www.finna.fi${cover}`, ["finna.fi"])
    : null;
  const creators = (record.nonPresenterAuthors ?? []).map((author) => author.name).filter(Boolean).slice(0, 3);
  return finish({
    id: `finna-${id}`,
    title: record.title ?? id,
    mediaType: "image",
    source: "finna",
    sourceUrl: hostedUrl(`https://www.finna.fi/Record/${encodeURIComponent(id)}`, ["finna.fi"]),
    previewUrl: preview,
    creator: creators.join(", "),
    license: record.imageRights?.copyright || "unspecified",
    attribution: creators[0] ?? null,
  });
}

function licenseFromId(id: string | undefined): string {
  const raw = (id ?? "").trim().toLowerCase();
  if (!raw) return "unspecified";
  if (raw.includes("cc-by-nc") || raw.includes("cc-by-nd")) return raw;
  if (raw.startsWith("cc-by-sa")) return "CC BY-SA";
  if (raw.startsWith("cc-by")) return "CC BY 4.0";
  if (raw.includes("cc0") || raw.includes("zero") || raw.includes("publicdomain")) return "CC0";
  return id ?? "unspecified";
}

export function candidateFromZenodo(hit: {
  id?: number;
  metadata?: {
    title?: string;
    license?: { id?: string };
    creators?: Array<{ name?: string }>;
    resource_type?: { type?: string };
  };
  links?: { self_html?: string };
}): DiscoveryCandidate | null {
  if (!hit.id) return null;
  const creators = (hit.metadata?.creators ?? []).map((creator) => creator.name).filter(Boolean).slice(0, 3);
  return finish({
    id: `zenodo-${hit.id}`,
    title: hit.metadata?.title ?? String(hit.id),
    mediaType: "dataset",
    source: "zenodo",
    sourceUrl: hostedUrl(hit.links?.self_html, ["zenodo.org"]),
    previewUrl: null,
    creator: creators.join(", "),
    license: licenseFromId(hit.metadata?.license?.id),
    hasVideo: (hit.metadata?.resource_type?.type ?? "").toLowerCase().includes("video"),
  });
}

export function candidateFromFigshare(article: {
  id?: number;
  title?: string;
  url_public_html?: string;
  license?: { name?: string };
  authors?: Array<{ full_name?: string }>;
  defined_type_name?: string;
}): DiscoveryCandidate | null {
  if (!article.id || article.defined_type_name !== "dataset") return null;
  const creators = (article.authors ?? []).map((author) => author.full_name).filter(Boolean).slice(0, 3);
  return finish({
    id: `figshare-${article.id}`,
    title: article.title ?? String(article.id),
    mediaType: "dataset",
    source: "figshare",
    sourceUrl: hostedUrl(article.url_public_html, ["figshare.com"]),
    previewUrl: null,
    creator: creators.join(", "),
    license: article.license?.name || "unspecified",
  });
}

export function candidateFromDataverse(item: {
  global_id?: string;
  name?: string;
  url?: string;
  license?: string | null;
  publisher?: string;
  authors?: string[];
}): DiscoveryCandidate | null {
  const id = (item.global_id ?? "").trim();
  if (!id || id.includes("..")) return null;
  const creators = Array.isArray(item.authors) ? item.authors.slice(0, 3).join(", ") : "";
  return finish({
    id: `dataverse-${id.replace(/[^\w.:/-]+/g, "-").slice(0, 80)}`,
    title: item.name ?? id,
    mediaType: "dataset",
    source: "dataverse",
    sourceUrl: hostedUrl(item.url, ["doi.org", "dataverse.harvard.edu"]),
    previewUrl: null,
    creator: creators || item.publisher || "Harvard Dataverse",
    license: typeof item.license === "string" && item.license.trim() ? item.license : "unspecified",
  });
}

export async function searchDiscoveryCatalog(
  source: string,
  query: string,
  limit: number,
  media: "image" | "video",
): Promise<CatalogSearchResult | null> {
  const safe = safeQuery(query);
  if (!safe) return { candidates: [], warning: "The query was empty. No files were downloaded." };
  if (source === "loc") return searchLoc(safe, limit, media);
  if (source === "nasa") return searchNasa(safe, limit, media);
  if (source === "wellcome") return searchWellcome(safe, limit);
  if (source === "cleveland") return searchCleveland(safe, limit);
  if (source === "artic") return searchArtic(safe, limit);
  if (source === "smk") return searchSmk(safe, limit);
  if (source === "finna") return searchFinna(safe, limit);
  if (source === "zenodo") return searchZenodo(safe, limit);
  if (source === "figshare") return searchFigshare(safe, limit);
  if (source === "dataverse") return searchDataverse(safe, limit);
  return null;
}

async function searchLoc(query: string, limit: number, media: "image" | "video"): Promise<CatalogSearchResult> {
  const endpoint = new URL(media === "video" ? "https://www.loc.gov/film-and-videos/" : "https://www.loc.gov/photos/");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("fo", "json");
  endpoint.searchParams.set("c", String(limit));
  const body = await readJson(endpoint.toString()) as { results?: Parameters<typeof candidateFromLibraryOfCongress>[0][] } | null;
  if (!body) return { candidates: [], warning: "The Library of Congress did not respond. No files were downloaded." };
  const candidates = (body.results ?? []).flatMap((item) => {
    const candidate = candidateFromLibraryOfCongress(item, media);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "Library of Congress results are catalog records. No file was downloaded." };
}

async function searchNasa(query: string, limit: number, media: "image" | "video"): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://images-api.nasa.gov/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("media_type", media);
  endpoint.searchParams.set("page_size", String(limit));
  const body = await readJson(endpoint.toString()) as { collection?: { items?: Parameters<typeof candidateFromNasa>[0][] } } | null;
  if (!body) return { candidates: [], warning: "NASA did not respond. No files were downloaded." };
  const candidates = (body.collection?.items ?? []).slice(0, limit).flatMap((item) => {
    const candidate = candidateFromNasa(item);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "NASA results stay ineligible unless that record states an open license. No file was downloaded." };
}

async function searchWellcome(query: string, limit: number): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://api.wellcomecollection.org/catalogue/v2/images");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("pageSize", String(limit));
  const body = await readJson(endpoint.toString()) as { results?: Parameters<typeof candidateFromWellcome>[0][] } | null;
  if (!body) return { candidates: [], warning: "Wellcome Collection did not respond. No files were downloaded." };
  const candidates = (body.results ?? []).flatMap((item) => {
    const candidate = candidateFromWellcome(item);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "Wellcome results are image records. No file was downloaded." };
}

async function searchCleveland(query: string, limit: number): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://openaccess-api.clevelandart.org/api/artworks/");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set("has_image", "1");
  const body = await readJson(endpoint.toString()) as { data?: Parameters<typeof candidateFromCleveland>[0][] } | null;
  if (!body) return { candidates: [], warning: "The Cleveland Museum of Art did not respond. No files were downloaded." };
  const candidates = (body.data ?? []).flatMap((item) => {
    const candidate = candidateFromCleveland(item);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "Cleveland results are open-access records. No file was downloaded." };
}

async function searchArtic(query: string, limit: number): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://api.artic.edu/api/v1/artworks/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set("fields", "id,title,artist_display,image_id,is_public_domain");
  endpoint.searchParams.set("query[term][is_public_domain]", "true");
  const body = await readJson(endpoint.toString()) as { data?: Parameters<typeof candidateFromArtic>[0][] } | null;
  if (!body) return { candidates: [], warning: "The Art Institute of Chicago did not respond. No files were downloaded." };
  const candidates = (body.data ?? []).flatMap((item) => {
    const candidate = candidateFromArtic(item);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "Art Institute results are limited to works the museum marks public domain. No file was downloaded." };
}

async function searchSmk(query: string, limit: number): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://api.smk.dk/api/v1/art/search/");
  endpoint.searchParams.set("keys", query);
  endpoint.searchParams.set("offset", "0");
  endpoint.searchParams.set("rows", String(limit));
  endpoint.searchParams.set("filters", "[public_domain:true]");
  const body = await readJson(endpoint.toString()) as { items?: Parameters<typeof candidateFromSmk>[0][] } | null;
  if (!body) return { candidates: [], warning: "SMK did not respond. No files were downloaded." };
  const candidates = (body.items ?? []).flatMap((item) => {
    const candidate = candidateFromSmk(item);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "SMK results are limited to works the museum marks public domain. No file was downloaded." };
}

async function searchFinna(query: string, limit: number): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://api.finna.fi/v1/search");
  endpoint.searchParams.set("lookfor", query);
  endpoint.searchParams.append("filter[]", "format:0/Image/");
  endpoint.searchParams.append("filter[]", "online_boolean:1");
  for (const field of ["title", "id", "images", "imageRights", "nonPresenterAuthors"]) {
    endpoint.searchParams.append("field[]", field);
  }
  endpoint.searchParams.set("limit", String(limit));
  const body = await readJson(endpoint.toString()) as { records?: Parameters<typeof candidateFromFinna>[0][] } | null;
  if (!body) return { candidates: [], warning: "Finna did not respond. No files were downloaded." };
  const candidates = (body.records ?? []).flatMap((item) => {
    const candidate = candidateFromFinna(item);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "Finna results use the image-rights field on each record. No file was downloaded." };
}

async function searchZenodo(query: string, limit: number): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://zenodo.org/api/records");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("size", String(limit));
  endpoint.searchParams.set("type", "dataset");
  const body = await readJson(endpoint.toString()) as { hits?: { hits?: Parameters<typeof candidateFromZenodo>[0][] } } | null;
  if (!body) return { candidates: [], warning: "Zenodo did not respond. No files were downloaded." };
  const candidates = (body.hits?.hits ?? []).flatMap((item) => {
    const candidate = candidateFromZenodo(item);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "Zenodo results are dataset records. No file was downloaded." };
}

async function searchFigshare(query: string, limit: number): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://api.figshare.com/v2/articles");
  endpoint.searchParams.set("search_for", query);
  endpoint.searchParams.set("page_size", String(limit));
  endpoint.searchParams.set("item_type", "3");
  const listed = await readJson(endpoint.toString()) as Array<{ id?: number }> | null;
  if (!Array.isArray(listed)) return { candidates: [], warning: "Figshare did not respond. No files were downloaded." };
  const details = await Promise.all(listed.slice(0, limit).map(async (row) => {
    if (!row.id || !Number.isInteger(row.id)) return null;
    return readJson(`https://api.figshare.com/v2/articles/${row.id}`) as Promise<Parameters<typeof candidateFromFigshare>[0] | null>;
  }));
  const candidates = details.flatMap((item) => {
    const candidate = item ? candidateFromFigshare(item) : null;
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "Figshare results are dataset records. No file was downloaded." };
}

async function searchDataverse(query: string, limit: number): Promise<CatalogSearchResult> {
  const endpoint = new URL("https://dataverse.harvard.edu/api/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("type", "dataset");
  endpoint.searchParams.set("per_page", String(limit));
  const body = await readJson(endpoint.toString()) as { data?: { items?: Parameters<typeof candidateFromDataverse>[0][] } } | null;
  if (!body) return { candidates: [], warning: "Harvard Dataverse did not respond. No files were downloaded." };
  const candidates = (body.data?.items ?? []).flatMap((item) => {
    const candidate = candidateFromDataverse(item);
    return candidate ? [candidate] : [];
  });
  return { candidates, warning: "Dataverse results are dataset records. A missing license stays ineligible. No file was downloaded." };
}

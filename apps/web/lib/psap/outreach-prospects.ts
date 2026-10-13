import type {
  PsapOutreachStatus,
  PsapProspect,
  PsapProspectListQuery,
  PsapProspectListResponse,
  PsapProspectStats,
} from "rapid-cortex-shared";
import { PSAP_OUTREACH_STATUSES } from "rapid-cortex-shared";
import catalog from "./outreach-prospects.json";
import { applyOutreachOverlay, getOutreachOverlay } from "./outreach-crm-store";

export const OUTREACH_VERTICALS = ["campus", "venue", "transit"] as const;
export type OutreachVertical = (typeof OUTREACH_VERTICALS)[number];

/** Prospect page vertical filter — includes national PSAP registry + sheet imports. */
export type ProspectVerticalFilter = "all" | "psap" | OutreachVertical;

export type OutreachProspect = {
  id: string;
  vertical: OutreachVertical;
  listKey: string;
  listLabel: string;
  name: string;
  state: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  contactName: string;
  contactRole: string;
  priority: string;
  /** Campus enrollment / student headcount when present on the source sheet. */
  studentCount?: number;
};

/** PsapProspect plus optional campus enrollment for Prospects UI. */
export type ProspectTableRow = PsapProspect & { studentCount?: number };

type Catalog = {
  generatedAt: string;
  counts: {
    total: number;
    byVertical: Record<string, number>;
    byList: Record<string, number>;
  };
  items: OutreachProspect[];
};

const DATA = catalog as Catalog;
const GENERATED_AT = `${DATA.generatedAt}T00:00:00.000Z`;

export const OUTREACH_PROSPECT_COUNTS = DATA.counts;

export const OUTREACH_LISTS: { listKey: string; listLabel: string; vertical: OutreachVertical }[] = [
  { listKey: "campus-k12", listLabel: "K-12 School Districts", vertical: "campus" },
  { listKey: "campus-universities", listLabel: "Physical University Campuses", vertical: "campus" },
  { listKey: "campus-hbcu", listLabel: "HBCU Campuses", vertical: "campus" },
  { listKey: "campus-cc-systems", listLabel: "Community College Systems", vertical: "campus" },
  { listKey: "venue-events", listLabel: "National Venues & Events", vertical: "venue" },
  { listKey: "venue-airports", listLabel: "US Airports", vertical: "venue" },
  { listKey: "venue-trails", listLabel: "Urban Trails & Greenways", vertical: "venue" },
  { listKey: "transit-agencies", listLabel: "Mass Transit Agencies", vertical: "transit" },
];

export function verticalFilterLabel(v: ProspectVerticalFilter): string {
  switch (v) {
    case "all":
      return "All Verticals";
    case "psap":
      return "PSAP / 911";
    case "campus":
      return "Campus";
    case "venue":
      return "Venue";
    case "transit":
      return "Transit";
  }
}

export function isOutreachProspectId(id: string): boolean {
  return (
    id.startsWith("campus-") ||
    id.startsWith("venue-") ||
    id.startsWith("transit-")
  );
}

function basePsapFromOutreach(row: OutreachProspect): PsapProspect {
  const street = row.address?.trim() || undefined;
  return {
    psapId: row.id,
    psapName: row.name,
    county: row.listLabel,
    state: row.state,
    city: row.city,
    phone: row.phone,
    fips: "",
    latitude: 0,
    longitude: 0,
    mailingAddress: street
      ? {
          streetAddress: street,
          city: row.city || "",
          county: row.listLabel,
          state: row.state || "",
          verified: false,
          source: "import",
        }
      : row.city || row.state
        ? {
            city: row.city || "",
            county: row.listLabel,
            state: row.state || "",
            verified: false,
            source: "import",
          }
        : undefined,
    primaryContactName: row.contactName || undefined,
    primaryContactTitle: row.contactRole || undefined,
    primaryContactEmail: row.email || undefined,
    website: row.website || undefined,
    outreachStatus: "UNCONTACTED",
    notes: row.priority ? `Priority: ${row.priority}` : undefined,
    activities: [],
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    importedFrom: row.listKey,
  };
}

export function outreachRowToPsapProspect(row: OutreachProspect): ProspectTableRow {
  const base = applyOutreachOverlay(basePsapFromOutreach(row), getOutreachOverlay(row.id));
  return row.studentCount != null ? { ...base, studentCount: row.studentCount } : base;
}

export function formatStudentCount(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function sortProspects(
  items: ProspectTableRow[],
  sortBy: NonNullable<PsapProspectListQuery["sortBy"]> | "studentCount",
  sortDir: "asc" | "desc",
): ProspectTableRow[] {
  const dir = sortDir === "desc" ? -1 : 1;
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (sortBy === "studentCount") {
      const an = a.studentCount ?? -1;
      const bn = b.studentCount ?? -1;
      return (an - bn) * dir;
    }
    let av = "";
    let bv = "";
    switch (sortBy) {
      case "state":
        av = a.state;
        bv = b.state;
        break;
      case "outreachStatus":
        av = a.outreachStatus;
        bv = b.outreachStatus;
        break;
      case "lastContactedAt":
        av = a.lastContactedAt ?? "";
        bv = b.lastContactedAt ?? "";
        break;
      case "updatedAt":
        av = a.updatedAt;
        bv = b.updatedAt;
        break;
      case "psapName":
      default:
        av = a.psapName;
        bv = b.psapName;
        break;
    }
    return av.localeCompare(bv, undefined, { sensitivity: "base" }) * dir;
  });
  return sorted;
}

export function listOutreachAsPsapProspects(opts: {
  vertical: ProspectVerticalFilter;
  listKey?: string;
  search?: string;
  state?: string;
  outreachStatus?: PsapOutreachStatus;
  hasAddress?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: PsapProspectListQuery["sortBy"] | "studentCount";
  sortDir?: "asc" | "desc";
}): PsapProspectListResponse & { items: ProspectTableRow[] } {
  const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : 50;
  const page = opts.page && opts.page > 0 ? opts.page : 1;
  const q = (opts.search ?? "").trim().toLowerCase();
  const state = (opts.state ?? "").trim().toUpperCase();

  let rows = DATA.items;
  if (opts.vertical !== "all" && opts.vertical !== "psap") {
    rows = rows.filter((r) => r.vertical === opts.vertical);
  } else if (opts.vertical === "psap") {
    rows = [];
  }
  if (opts.listKey) rows = rows.filter((r) => r.listKey === opts.listKey);
  if (state) rows = rows.filter((r) => r.state.toUpperCase() === state);
  if (q) {
    rows = rows.filter((r) =>
      [r.name, r.city, r.state, r.phone, r.email, r.contactName, r.contactRole, r.listLabel, r.address]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  let items: ProspectTableRow[] = rows.map(outreachRowToPsapProspect);
  if (opts.outreachStatus) {
    items = items.filter((p) => p.outreachStatus === opts.outreachStatus);
  }
  if (opts.hasAddress === true) {
    items = items.filter((p) => Boolean(p.mailingAddress?.streetAddress?.trim()));
  } else if (opts.hasAddress === false) {
    items = items.filter((p) => !p.mailingAddress?.streetAddress?.trim());
  }

  items = sortProspects(items, opts.sortBy ?? "psapName", opts.sortDir ?? "asc");

  const total = items.length;
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

export function computeOutreachStats(opts: {
  vertical: ProspectVerticalFilter;
  listKey?: string;
}): PsapProspectStats {
  const all = listOutreachAsPsapProspects({
    vertical: opts.vertical,
    listKey: opts.listKey,
    page: 1,
    pageSize: 100_000,
  }).items;

  const byStatus = Object.fromEntries(PSAP_OUTREACH_STATUSES.map((s) => [s, 0])) as Record<
    PsapOutreachStatus,
    number
  >;
  let withAddress = 0;
  let withContact = 0;
  let totalEstimatedValue = 0;
  for (const p of all) {
    byStatus[p.outreachStatus] = (byStatus[p.outreachStatus] ?? 0) + 1;
    if (p.mailingAddress?.streetAddress?.trim()) withAddress += 1;
    if (p.primaryContactName || p.primaryContactEmail || p.primaryContactPhone) withContact += 1;
    if (p.estimatedValue) totalEstimatedValue += p.estimatedValue;
  }
  return {
    total: all.length,
    byStatus,
    withAddress,
    withContact,
    totalEstimatedValue,
  };
}

/** @deprecated use listOutreachAsPsapProspects */
export function listOutreachProspects(opts: {
  vertical: ProspectVerticalFilter;
  listKey?: string;
  search?: string;
  state?: string;
  page?: number;
  pageSize?: number;
}): { items: OutreachProspect[]; total: number; page: number; pageSize: number; hasMore: boolean } {
  const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : 50;
  const page = opts.page && opts.page > 0 ? opts.page : 1;
  const q = (opts.search ?? "").trim().toLowerCase();
  const state = (opts.state ?? "").trim().toUpperCase();

  let items = DATA.items;
  if (opts.vertical !== "all" && opts.vertical !== "psap") {
    items = items.filter((r) => r.vertical === opts.vertical);
  } else if (opts.vertical === "psap") {
    items = [];
  }
  if (opts.listKey) items = items.filter((r) => r.listKey === opts.listKey);
  if (state) items = items.filter((r) => r.state.toUpperCase() === state);
  if (q) {
    items = items.filter((r) =>
      [r.name, r.city, r.state, r.phone, r.email, r.contactName, r.contactRole, r.listLabel, r.address]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

export function buildOutreachCsv(items: ProspectTableRow[]): string {
  const header = [
    "Name",
    "State",
    "City",
    "List",
    "Students",
    "Phone",
    "Contact",
    "Title",
    "Email",
    "Website",
    "Address",
    "Status",
    "Notes",
  ];
  const lines = [header.join(",")];
  for (const p of items) {
    const cols = [
      p.psapName,
      p.state,
      p.city,
      p.county,
      p.studentCount != null ? String(p.studentCount) : "",
      p.phone,
      p.primaryContactName ?? "",
      p.primaryContactTitle ?? "",
      p.primaryContactEmail ?? "",
      p.website ?? "",
      p.mailingAddress?.streetAddress ?? "",
      p.outreachStatus,
      p.notes ?? "",
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    lines.push(cols.join(","));
  }
  return lines.join("\n");
}

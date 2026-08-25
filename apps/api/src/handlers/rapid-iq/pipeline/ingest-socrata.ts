/**
 * Socrata state open-data contracts ingestion (SODA API).
 * Dataset IDs are placeholders — verify per portal before production.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { rapidIqIngestSinceDate } from "../../../lib/rapid-iq/ingest-window.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

interface SocrataSource {
  state: string;
  stateName: string;
  baseUrl: string;
  datasetId: string;
  vendorField: string;
  descriptionField: string;
  amountField: string;
  dateField: string;
  agencyField?: string;
}

const SOCRATA_SOURCES: SocrataSource[] = [
  {
    state: "TX",
    stateName: "Texas",
    baseUrl: "https://data.texas.gov",
    datasetId: "p86d-xgke",
    vendorField: "vendor_name",
    descriptionField: "contract_description",
    amountField: "total_amount",
    dateField: "begin_date",
    agencyField: "agency_name",
  },
  {
    state: "NY",
    stateName: "New York",
    baseUrl: "https://data.ny.gov",
    datasetId: "7ytw-dq4x",
    vendorField: "vendor_name",
    descriptionField: "description",
    amountField: "contract_amount",
    dateField: "contract_date",
    agencyField: "agency_name",
  },
  {
    state: "CA",
    stateName: "California",
    baseUrl: "https://data.ca.gov",
    datasetId: "c64r-4ys3",
    vendorField: "supplier_name",
    descriptionField: "description",
    amountField: "awarded_amount",
    dateField: "award_date",
    agencyField: "dept_name",
  },
  {
    state: "FL",
    stateName: "Florida",
    baseUrl: "https://data.myflorida.com",
    datasetId: "8tgr-ghad",
    vendorField: "vendor_name",
    descriptionField: "item_description",
    amountField: "total_price",
    dateField: "contract_start_date",
    agencyField: "agency",
  },
  {
    state: "GA",
    stateName: "Georgia",
    baseUrl: "https://data.georgia.gov",
    datasetId: "f46y-2t4r",
    vendorField: "vendor",
    descriptionField: "description",
    amountField: "amount",
    dateField: "award_date",
    agencyField: "agency",
  },
  {
    state: "IL",
    stateName: "Illinois",
    baseUrl: "https://data.illinois.gov",
    datasetId: "shf2-v4gx",
    vendorField: "vendor_name",
    descriptionField: "short_description",
    amountField: "maximum_amount",
    dateField: "start_date",
    agencyField: "agency_name",
  },
  {
    state: "NC",
    stateName: "North Carolina",
    baseUrl: "https://data.nc.gov",
    datasetId: "bvam-t5rx",
    vendorField: "vendor_name",
    descriptionField: "description",
    amountField: "total_amount",
    dateField: "effective_date",
    agencyField: "agency",
  },
  {
    state: "WA",
    stateName: "Washington",
    baseUrl: "https://data.wa.gov",
    datasetId: "ypbn-sfvs",
    vendorField: "supplier_name",
    descriptionField: "item_description",
    amountField: "total_contract_value",
    dateField: "award_date",
    agencyField: "agency",
  },
  {
    state: "CO",
    stateName: "Colorado",
    baseUrl: "https://data.colorado.gov",
    datasetId: "3fpj-e7je",
    vendorField: "vendor",
    descriptionField: "description",
    amountField: "amount",
    dateField: "start_date",
    agencyField: "department",
  },
  {
    state: "OH",
    stateName: "Ohio",
    baseUrl: "https://data.ohio.gov",
    datasetId: "r8s4-jqfd",
    vendorField: "vendor_name",
    descriptionField: "service_description",
    amountField: "contract_amount",
    dateField: "contract_begin_date",
    agencyField: "agency_name",
  },
  {
    state: "PA",
    stateName: "Pennsylvania",
    baseUrl: "https://data.pa.gov",
    datasetId: "gmfm-8n9p",
    vendorField: "vendor_name",
    descriptionField: "description",
    amountField: "award_amount",
    dateField: "award_date",
    agencyField: "agency",
  },
  {
    state: "MI",
    stateName: "Michigan",
    baseUrl: "https://data.michigan.gov",
    datasetId: "n8a4-cna4",
    vendorField: "vendor_name",
    descriptionField: "contract_description",
    amountField: "total_amount",
    dateField: "start_date",
    agencyField: "agency_name",
  },
  {
    state: "VA",
    stateName: "Virginia",
    baseUrl: "https://data.virginia.gov",
    datasetId: "kfjs-pu3m",
    vendorField: "vendor",
    descriptionField: "description",
    amountField: "total",
    dateField: "po_date",
    agencyField: "agency",
  },
  {
    state: "TN",
    stateName: "Tennessee",
    baseUrl: "https://data.tn.gov",
    datasetId: "yy9r-9d4e",
    vendorField: "supplier_name",
    descriptionField: "description",
    amountField: "amount",
    dateField: "effective_date",
    agencyField: "department",
  },
  {
    state: "IN",
    stateName: "Indiana",
    baseUrl: "https://data.in.gov",
    datasetId: "r5qe-m3y8",
    vendorField: "vendor",
    descriptionField: "description",
    amountField: "contract_amount",
    dateField: "start_date",
    agencyField: "agency",
  },
];

const VENDOR_KEYWORDS = [
  "Tyler Technologies",
  "Motorola Solutions",
  "CentralSquare",
  "Hexagon Safety",
  "Axon Enterprise",
  "RapidSOS",
  "Priority Dispatch",
  "Carbyne",
  "Zetron",
  "L3Harris",
  "Comtech",
  "GovWorx",
];

const DESCRIPTION_KEYWORDS = [
  "computer aided dispatch",
  "CAD system",
  "911 system",
  "PSAP",
  "dispatch center",
  "emergency communications",
  "public safety software",
  "radio system upgrade",
  "interoperability",
  "NG911",
  "next generation 911",
  "communications center",
  "dispatch console",
  "call handling",
  "records management system",
];

async function queryDataset(source: SocrataSource): Promise<void> {
  const fromDate = rapidIqIngestSinceDate();

  const vendorConditions = VENDOR_KEYWORDS.map(
    (kw) => `upper(${source.vendorField}) like upper('%${kw}%')`,
  ).join(" OR ");

  const descConditions = DESCRIPTION_KEYWORDS.map(
    (kw) => `upper(${source.descriptionField}) like upper('%${kw}%')`,
  ).join(" OR ");

  const whereClause = `(${vendorConditions}) OR (${descConditions})`;
  const dateFilter = `${source.dateField} >= '${fromDate}'`;

  const fields = [
    source.vendorField,
    source.descriptionField,
    source.amountField,
    source.dateField,
    ...(source.agencyField ? [source.agencyField] : []),
  ].join(",");

  const params = new URLSearchParams({
    $where: `(${whereClause}) AND ${dateFilter}`,
    $select: fields,
    $limit: "100",
    $order: `${source.dateField} DESC`,
  });

  const url = `${source.baseUrl}/resource/${source.datasetId}.json?${params}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RapidCortex-IQ/1.0 (procurement-monitor)",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    console.warn(`Socrata ${source.state} (${source.datasetId}): HTTP ${res.status}`);
    return;
  }

  const rows = (await res.json()) as Record<string, string>[];
  console.log(`Socrata ${source.state}: ${rows.length} relevant rows`);

  for (const row of rows) {
    const vendor = row[source.vendorField] ?? "";
    const description = row[source.descriptionField] ?? "";
    const amountRaw = row[source.amountField];
    const amount = amountRaw != null ? Number.parseFloat(amountRaw) : undefined;
    const date = row[source.dateField] ?? new Date().toISOString();
    const agency = source.agencyField ? (row[source.agencyField] ?? "") : "";

    const signal: RapidIqPipelineRawSignal = {
      sourceId: "socrata",
      sourceUrl: `${source.baseUrl}/resource/${source.datasetId}`,
      rawTitle: `[${source.stateName} State Contract] ${vendor} — ${description.slice(0, 80)}`,
      rawSnippet: JSON.stringify({
        state: source.state,
        stateName: source.stateName,
        vendor,
        description,
        amount: Number.isFinite(amount) ? amount : undefined,
        date,
        agency,
        source: `${source.baseUrl}/d/${source.datasetId}`,
      }),
      signalDate: date.slice(0, 10),
    };

    await enqueueRawSignal(signal, {
      dedupeId: `socrata-${source.state}-${vendor}-${description}-${date}`,
      groupId: "socrata",
    });
  }
}

export async function handler(): Promise<void> {
  console.log("Rapid IQ pipeline: Socrata ingestion starting");

  if (await enqueueMockIfEnabled("socrata")) {
    console.log("Rapid IQ pipeline: Socrata mock path complete");
    return;
  }

  for (const source of SOCRATA_SOURCES) {
    try {
      await queryDataset(source);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`Socrata ${source.state} failed:`, err);
    }
  }

  console.log("Rapid IQ pipeline: Socrata ingestion complete");
}

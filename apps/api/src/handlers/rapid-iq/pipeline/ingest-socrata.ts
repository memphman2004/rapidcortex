/**
 * Socrata / SODA contract ingest — only live-verified dataset IDs.
 */

import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { rapidIqIngestSinceDate } from "../../../lib/rapid-iq/ingest-window.js";
import { RAPID_IQ_BROWSER_UA } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { enqueueMockIfEnabled, enqueueRawSignal } from "./queue-raw-signal.js";

interface SocrataSource {
  state: string;
  stateName: string;
  baseUrl: string;
  datasetId: string;
  vendorField: string;
  descriptionField: string;
  amountField?: string;
  dateField?: string;
  agencyField?: string;
}

/** Live-verified SODA datasets (2026-09-17). Placeholder IDs 404'd every daily run. */
export const SOCRATA_SOURCES: SocrataSource[] = [
  {
    state: "TX",
    stateName: "Texas DIR cooperative contracts",
    baseUrl: "https://data.texas.gov",
    datasetId: "vipt-h4ye",
    vendorField: "primary_vendor_name",
    descriptionField: "rfo_description",
    dateField: "contract_start",
    agencyField: "contract_type",
  },
  {
    state: "TX",
    stateName: "Texas DIR contract sales",
    baseUrl: "https://data.texas.gov",
    datasetId: "w64c-ndf7",
    vendorField: "vendor_name",
    descriptionField: "rfo_description",
    amountField: "purchase_amount",
    dateField: "contract_start_date",
    agencyField: "customer_name",
  },
  {
    state: "IL",
    stateName: "City of Chicago purchase orders",
    baseUrl: "https://data.cityofchicago.org",
    datasetId: "rsxa-ify5",
    vendorField: "vendor_name",
    descriptionField: "purchase_order_description",
    amountField: "award_amount",
    dateField: "approval_date",
    agencyField: "department",
  },
  {
    state: "TX",
    stateName: "City of Austin purchasing",
    baseUrl: "https://data.austintexas.gov",
    datasetId: "3ebq-e9iz",
    vendorField: "lgl_nm",
    descriptionField: "commodity_description",
    amountField: "itm_tot_am",
    dateField: "award_date",
    agencyField: "contract_name",
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
  const dateFilter = source.dateField ? ` AND ${source.dateField} >= '${fromDate}'` : "";

  const fields = [
    source.vendorField,
    source.descriptionField,
    source.amountField,
    source.dateField,
    source.agencyField,
  ]
    .filter((f): f is string => Boolean(f))
    .join(",");

  const params = new URLSearchParams({
    $where: `${whereClause}${dateFilter}`,
    $select: fields,
    $limit: "100",
  });
  if (source.dateField) params.set("$order", `${source.dateField} DESC`);

  const url = `${source.baseUrl}/resource/${source.datasetId}.json?${params}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": RAPID_IQ_BROWSER_UA,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    console.warn(`Socrata ${source.state} (${source.datasetId}): HTTP ${res.status}`);
    if (res.status === 400 && source.dateField) {
      await queryDataset({ ...source, dateField: undefined });
    }
    return;
  }

  const rows = (await res.json()) as Record<string, string>[];
  console.log(`Socrata ${source.state}: ${rows.length} relevant rows`);

  for (const row of rows) {
    const vendor = row[source.vendorField] ?? "";
    const description = row[source.descriptionField] ?? "";
    const amountRaw = source.amountField ? row[source.amountField] : undefined;
    const amount = amountRaw != null ? Number.parseFloat(amountRaw) : undefined;
    const date = (source.dateField ? row[source.dateField] : undefined) ?? new Date().toISOString();
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

import { runBerkeleyToCharlestonDemo } from "./demo";

const result = runBerkeleyToCharlestonDemo();
const lines = [
  `Ingested ${result.ingested.length} Berkeley County incidents`,
  `Transferred ${result.transfers.length} EIDO documents to Charleston County`,
  `Held local ${result.skipped.length}: ${result.skipped.map((s) => s.incidentId).join(", ") || "(none)"}`,
  "",
  "Transfers:",
  ...result.transfers.map(
    (t) =>
      `  ${t.incidentId}  rule=${t.ruleId}  type=${t.eido.incidentComponent?.[0]?.commonIncidentTypeCode}  eido=${t.eido.$id}`,
  ),
];
process.stdout.write(`${lines.join("\n")}\n`);

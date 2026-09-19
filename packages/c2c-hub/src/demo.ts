import { BERKELEY_COUNTY, CHARLESTON_COUNTY, SEED_TRANSFER_RULES } from "./seed";
import { berkeleyMockAdapter, charlestonMockAdapter } from "./adapters/mock";
import { C2cHub } from "./hub";

export function createDemoHub() {
  const berkeley = berkeleyMockAdapter();
  const charleston = charlestonMockAdapter();
  const hub = new C2cHub(
    [BERKELEY_COUNTY, CHARLESTON_COUNTY],
    SEED_TRANSFER_RULES,
    new Map([
      [BERKELEY_COUNTY.agencyId, berkeley],
      [CHARLESTON_COUNTY.agencyId, charleston],
    ]),
  );
  return { hub, berkeley, charleston };
}

export function runBerkeleyToCharlestonDemo() {
  const demo = createDemoHub();
  const result = demo.hub.runProducer(BERKELEY_COUNTY.agencyId);
  return { ...result, charlestonInbox: demo.charleston.receivedTransfers() };
}

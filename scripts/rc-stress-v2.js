/**
 * Alias so `k6 run scripts/rc-stress-v2.js` matches the runner default
 * at scripts/perf/rc-stress-v2.js.
 */
export {
  options,
  sustainedLoad,
  spikeLoad,
  handleSummary,
} from "./perf/rc-stress-v2.js";

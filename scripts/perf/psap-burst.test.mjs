import assert from "node:assert/strict";
import test from "node:test";
import { summarizeBurst } from "./psap-burst.mjs";

test("500 statuses at c=200 is a pass", () => {
  const results = Array.from({ length: 500 }, () => ({ status: 200 }));
  const summary = summarizeBurst(results, 500);
  assert.equal(summary.pass, true);
  assert.equal(summary.missing, 0);
});

test("a shortfall versus -n is a failure even with no HTTP error", () => {
  const results = Array.from({ length: 450 }, () => ({ status: 200 }));
  const summary = summarizeBurst(results, 500);
  assert.equal(summary.pass, false);
  assert.equal(summary.missing, 50);
  assert.equal(summary.http5xx, 0);
});

test("429 and network failures fail the burst", () => {
  const throttled = summarizeBurst([{ status: 200 }, { status: 429 }], 2);
  assert.equal(throttled.pass, false);
  assert.equal(throttled.http429, 1);
  const dropped = summarizeBurst([{ status: 200 }, { status: 0 }], 2);
  assert.equal(dropped.pass, false);
  assert.equal(dropped.network, 1);
});

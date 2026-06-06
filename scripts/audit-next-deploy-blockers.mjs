#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BLOCKERS_FILE_ARG = process.argv[2];
const blockersFile = resolve(
  BLOCKERS_FILE_ARG ?? "docs/NEXT_DEPLOY_BLOCKERS.md",
);

const PASS_STATUSES = new Set(["PASS", "MITIGATED", "NOT APPLICABLE"]);
const PENDING_STATUSES = new Set([
  "NOT STARTED",
  "IN PROGRESS",
  "PARTIAL",
  "FAIL",
]);

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

if (!existsSync(blockersFile)) {
  fail(`Blockers file not found: ${blockersFile}`);
}

const fileContent = readFileSync(blockersFile, "utf8");
const lines = fileContent.split(/\r?\n/);

/** @type {{id: string; status: string; priority: string; lineNumber: number}[]} */
const unresolvedP0Rows = [];

for (let index = 0; index < lines.length; index += 1) {
  const rawLine = lines[index];
  if (!rawLine.includes("|")) {
    continue;
  }

  const trimmedLine = rawLine.trim();
  if (!trimmedLine.startsWith("|")) {
    continue;
  }

  const cells = trimmedLine
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, cellIndex, array) => {
      if (cellIndex === 0 && array[cellIndex] === "") return false;
      if (cellIndex === array.length - 1 && array[cellIndex] === "") return false;
      return true;
    });

  if (cells.length < 9) {
    continue;
  }

  const rowId = cells[0];
  if (!rowId || rowId === "ID" || /^-+$/.test(rowId)) {
    continue;
  }

  const status = cells[7]?.toUpperCase();
  const priority = cells[8]?.toUpperCase();
  if (!status || !priority || !priority.includes("P0")) {
    continue;
  }

  if (PASS_STATUSES.has(status)) {
    continue;
  }

  if (!PENDING_STATUSES.has(status)) {
    fail(
      `Unexpected status '${cells[7]}' for row '${rowId}' at line ${index + 1}. ` +
        `Allowed statuses: ${[...PASS_STATUSES, ...PENDING_STATUSES].join(", ")}`,
    );
  }

  unresolvedP0Rows.push({
    id: rowId,
    status: cells[7],
    priority: cells[8],
    lineNumber: index + 1,
  });
}

if (unresolvedP0Rows.length > 0) {
  console.error("❌ P0 blockers remain unresolved:");
  for (const blocker of unresolvedP0Rows) {
    console.error(
      `   - ${blocker.id} (${blocker.priority}) is ${blocker.status} [line ${blocker.lineNumber}]`,
    );
  }
  process.exit(1);
}

console.log("✅ No P0 blockers found!");

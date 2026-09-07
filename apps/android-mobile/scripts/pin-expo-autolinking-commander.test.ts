import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import {
  isCommander7,
  pinCommanderUnderExpoAutolinking,
  readPkgVersion,
} from "./pin-expo-autolinking-commander.js";

const __importDefault = (mod: { __esModule?: boolean; default?: unknown } | object) =>
  (mod as { __esModule?: boolean }).__esModule ? mod : { default: mod };

function writePkg(dir: string, name: string, version: string, extra = "") {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name, version, main: "index.js" }),
  );
  if (extra) {
    writeFileSync(path.join(dir, "index.js"), extra);
  }
}

/** commander 7: default export is the program instance with .command(). */
const COMMANDER_7_INDEX = `
class Command { command() { return this; } }
module.exports = new Command();
exports.program = exports;
exports.Command = Command;
exports.Option = class Option {};
`;

/** commander 12: named exports only — the EAS Configure project failure. */
const COMMANDER_12_INDEX = `
class Command { command() { return this; } }
exports.program = new Command();
exports.Command = Command;
exports.Option = class Option {};
`;

function makeWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), "rc-autolink-cmd-"));
  const workspaceRoot = path.join(root, "repo");
  const mobileRoot = path.join(workspaceRoot, "apps", "mobile");
  const rootNm = path.join(workspaceRoot, "node_modules");
  mkdirSync(path.join(mobileRoot, "node_modules"), { recursive: true });

  writePkg(path.join(rootNm, "commander"), "commander", "7.2.0", COMMANDER_7_INDEX);
  writePkg(
    path.join(rootNm, "expo", "node_modules", "commander"),
    "commander",
    "12.1.0",
    COMMANDER_12_INDEX,
  );
  writePkg(
    path.join(rootNm, "expo", "node_modules", "expo-modules-autolinking"),
    "expo-modules-autolinking",
    "2.0.8",
  );

  const nestedCommander = path.join(
    rootNm,
    "expo",
    "node_modules",
    "expo-modules-autolinking",
    "node_modules",
    "commander",
  );
  const requireFromAutolinking = createRequire(
    path.join(rootNm, "expo", "node_modules", "expo-modules-autolinking", "build", "index.js"),
  );
  return { root, workspaceRoot, mobileRoot, nestedCommander, requireFromAutolinking };
}

describe("pin commander 7 under expo-modules-autolinking", () => {
  const temps: string[] = [];

  afterEach(() => {
    for (const dir of temps.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats 7.x as the autolinking-compatible commander", () => {
    expect(isCommander7("7.2.0")).toBe(true);
    expect(isCommander7("12.1.0")).toBe(false);
    expect(isCommander7(null)).toBe(false);
  });

  it("reproduces Configure project: hoisted commander 12 has no default.command", () => {
    const ctx = makeWorkspace();
    temps.push(ctx.root);
    const resolved = ctx.requireFromAutolinking.resolve("commander");
    expect(resolved).toContain(`${path.sep}expo${path.sep}node_modules${path.sep}commander`);
    const loaded = __importDefault(ctx.requireFromAutolinking("commander")) as {
      default: { command?: unknown };
    };
    expect(typeof loaded.default.command).not.toBe("function");
  });

  it("nests commander 7 so autolinking does not resolve hoisted commander 12", () => {
    const ctx = makeWorkspace();
    temps.push(ctx.root);
    expect(existsSync(ctx.nestedCommander)).toBe(false);

    const result = pinCommanderUnderExpoAutolinking({
      mobileRoot: ctx.mobileRoot,
      workspaceRoot: ctx.workspaceRoot,
    });
    expect(result.pinned.length).toBeGreaterThan(0);
    expect(readPkgVersion(ctx.nestedCommander)).toBe("7.2.0");

    const resolved = ctx.requireFromAutolinking.resolve("commander");
    expect(resolved).toContain(
      `${path.sep}expo-modules-autolinking${path.sep}node_modules${path.sep}commander`,
    );
    const loaded = __importDefault(ctx.requireFromAutolinking("commander")) as {
      default: { command?: unknown };
    };
    expect(typeof loaded.default.command).toBe("function");
  });
});

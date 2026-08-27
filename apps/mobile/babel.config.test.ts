import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const babelFactory = require("./babel.config.js") as (api: {
  cache: (enabled: boolean) => void;
}) => { plugins: unknown[] };

describe("mobile babel config", () => {
  it("registers expo-router env inlining for the monorepo hoist gap", () => {
    const config = babelFactory({ cache() {} });
    const pluginFns = config.plugins.filter(
      (plugin): plugin is { name: string } => typeof plugin === "function",
    );
    expect(pluginFns.some((plugin) => plugin.name === "expoRouterBabelPlugin")).toBe(
      true,
    );
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Substrings forbidden in deception module sources — also asserted by unit tests for isolation guarantees. */
export const DECEPTION_IMPORT_DENYLIST: readonly string[] = [
  "../services/",
  "../repositories/",
  "from \"../lib/",
  "from '../lib/",
  "rapid-cortex-integrations",
  "rapid-cortex-security",
  "rapid-cortex-shared",
  "@aws-sdk/client-cognito",
  "@aws-sdk/client-secrets-manager",
];

const FORBIDDEN_IMPORT_SNIPPETS = DECEPTION_IMPORT_DENYLIST;

let verified = false;

/** Cold-start guard: deception handlers must stay isolated from production services. */
export function assertDeceptionModuleIsolation(): void {
  if (verified) return;
  /** Resolved at emit time for CommonJS (`module: CommonJS` in tsconfig.base). */
  const here = __dirname;
  const files = readdirSync(here).filter((f) => {
    if (f.endsWith(".map")) return false;
    if (f.endsWith(".test.ts") || f.endsWith(".test.js")) return false;
    return f.endsWith(".ts") || f.endsWith(".js");
  });
  for (const f of files) {
    if (f === "assertDeceptionIsolation.ts" || f === "assertDeceptionIsolation.js") continue;
    const text = readFileSync(join(here, f), "utf8");
    for (const bad of FORBIDDEN_IMPORT_SNIPPETS) {
      if (text.includes(bad)) {
        throw new Error(`DECEPTION_ISOLATION_VIOLATION:${f}:${bad}`);
      }
    }
  }
  verified = true;
}

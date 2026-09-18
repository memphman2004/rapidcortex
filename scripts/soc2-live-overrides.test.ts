import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("SOC 2 live production overrides", () => {
  it("forces CloudTrail, PITR, and API WAF on for DeploymentStage=dev", () => {
    const script = path.join(repoRoot, "scripts/lib/soc2-live-production-overrides.sh");
    const body = fs.readFileSync(script, "utf8");
    expect(body).toContain("export ENABLE_CLOUD_TRAIL=true");
    expect(body).toContain("export DDB_ENABLE_PITR=true");
    expect(body).toContain("export ENABLE_API_WAF=true");

    const out = execFileSync(
      "bash",
      [
        "-lc",
        `ENABLE_CLOUD_TRAIL=false DDB_ENABLE_PITR=auto ENABLE_API_WAF=false; source "${script}"; printf '%s %s %s' "$ENABLE_CLOUD_TRAIL" "$DDB_ENABLE_PITR" "$ENABLE_API_WAF"`,
      ],
      { encoding: "utf8" },
    );
    expect(out.trim().split("\n").at(-1)).toBe("true true true");
  });

  it("honors break-glass instead of forcing controls", () => {
    const script = path.join(repoRoot, "scripts/lib/soc2-live-production-overrides.sh");
    const out = execFileSync(
      "bash",
      [
        "-lc",
        `SOC2_ALLOW_DISABLE_LIVE_CONTROLS=1 ENABLE_CLOUD_TRAIL=false; source "${script}"; printf '%s' "$ENABLE_CLOUD_TRAIL"`,
      ],
      { encoding: "utf8" },
    );
    expect(out.trim().split("\n").at(-1)).toBe("false");
  });

  it("is sourced from deploy.sh and deploy2.sh on STAGE=dev", () => {
    for (const rel of ["scripts/deploy.sh", "scripts/deploy2.sh"]) {
      const text = fs.readFileSync(path.join(repoRoot, rel), "utf8");
      expect(text).toContain("soc2-live-production-overrides.sh");
      expect(text).toContain("DynamoPointInTimeRecovery=${DDB_ENABLE_PITR}");
      expect(text).toContain("EnableCloudTrail=${ENABLE_CLOUD_TRAIL}");
      expect(text).toContain("EnableApiWaf=${ENABLE_API_WAF}");
    }
  });

  it("example live env exports the three SOC 2 overrides", () => {
    const text = fs.readFileSync(path.join(repoRoot, "scripts/env-api-dev.example.sh"), "utf8");
    expect(text).toContain("I_UNDERSTAND_DEV_IS_PROD=1");
    expect(text).toContain("ENABLE_CLOUD_TRAIL=true");
    expect(text).toContain("DDB_ENABLE_PITR=true");
    expect(text).toContain("ENABLE_API_WAF=true");
    expect(text).not.toMatch(/ENABLE_CLOUD_TRAIL=false/);
  });

  it("keeps the live stack name rapid-cortex-dev (no rename)", () => {
    const deploy = fs.readFileSync(path.join(repoRoot, "scripts/deploy.sh"), "utf8");
    expect(deploy).toContain("rapid-cortex-dev");
    expect(deploy).toContain("Do not rename");
  });
});

describe("SOC 2 auditor IAM policy", () => {
  it("allows creating rc-soc2-auditor in the prod deploy policy", () => {
    const doc = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "infra/iam/sam-deploy-policy-soc2.prod.json"), "utf8"),
    );
    const resources: string[] = doc.Statement[0].Resource;
    expect(resources).toContain("arn:aws:iam::158961537080:role/rc-soc2-auditor");
    expect(resources).toContain("arn:aws:iam::158961537080:role/rapid-cortex-soc2-auditor");
    const compact = JSON.stringify(doc);
    expect(compact.length).toBeLessThanOrEqual(6144);
  });
});

describe("SOC 2 snapshot scoring", () => {
  it("python unit tests pass", () => {
    execFileSync("python3", [path.join(repoRoot, "scripts/lib/soc2_controls_verdict.test.py")], {
      stdio: "inherit",
    });
  });

  it("scores the 2026-10 evidence pack as all PASS or ACCEPT", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soc2-verdict-"));
    const result = execFileSync(
      "python3",
      [
        path.join(repoRoot, "scripts/lib/soc2_controls_verdict.py"),
        "--summary",
        path.join(repoRoot, "docs/evidence/soc2-evidence/2026-10-snapshot/SUMMARY.json"),
        "--raw",
        path.join(repoRoot, "docs/evidence/soc2-evidence/2026-10-snapshot/raw"),
        "--stamp",
        "20260917T225823Z",
        "--out",
        tmp,
        "--sop",
        path.join(repoRoot, "docs/evidence/soc2-evidence/2026-10/secrets-rotation-sop.md"),
      ],
      { encoding: "utf8" },
    );
    const parsed = JSON.parse(result.trim().split("\n").at(-1) || "{}");
    expect(parsed.overall).toBe("PASS");
    const verdict = JSON.parse(fs.readFileSync(path.join(tmp, "VERDICT.json"), "utf8"));
    for (const row of verdict.controls) {
      expect(["PASS", "ACCEPT"]).toContain(row.status);
    }
  });
});

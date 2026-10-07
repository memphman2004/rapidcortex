import { execSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "vitest";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../../../../");

describe("KVS WebRTC shell scripts", () => {
  it("setup-kvs-webrtc.sh parses (bash -n)", () => {
    execSync(`bash -n "${path.join(repoRoot, "scripts/setup-kvs-webrtc.sh")}"`, { stdio: "inherit" });
  });
  it("check-kvs-webrtc.sh parses (bash -n)", () => {
    execSync(`bash -n "${path.join(repoRoot, "scripts/check-kvs-webrtc.sh")}"`, { stdio: "inherit" });
  });
});

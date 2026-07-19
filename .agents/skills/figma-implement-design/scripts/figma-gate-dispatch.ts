#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

function fail(message: string): never {
  console.error(`FAIL\n- ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2).filter((arg) => arg !== "--");
if (argv.length !== 2 || argv[0] !== "--artifact" || !argv[1]) {
  fail("usage: figma-gate:all --artifact <implementation-artifact.json>");
}
const artifactPath = path.resolve(argv[1]);
let artifact: { target?: { kind?: string } };
try {
  artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
} catch {
  fail(`unreadable implementation artifact: ${artifactPath}`);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const script =
  artifact.target?.kind === "screen"
    ? path.resolve(scriptDir, "../../figma-implement-screen/scripts/figma-gate-screen.ts")
    : artifact.target?.kind === "design-system-component"
      ? path.resolve(scriptDir, "../../figma-implement-component/scripts/figma-gate-component.ts")
      : null;
if (!script) fail(`unsupported target.kind: ${artifact.target?.kind ?? "missing"}`);

const result = spawnSync("pnpm", ["exec", "tsx", script, "--artifact", artifactPath], {
  cwd: process.cwd(),
  encoding: "utf-8",
  stdio: "inherit",
});
process.exit(result.status ?? 1);

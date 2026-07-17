#!/usr/bin/env tsx
/**
 * Offline pressure tests for figma-props-sync finalize validate.
 * Does not call Figma API; does not write into real .figma/prop-map.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const script = path.join(root, ".agents/skills/figma-props-sync/scripts/figma-props-sync.cjs");
const fixtures = path.join(root, ".agents/skills/figma-props-sync/scripts/fixtures");

function runFinalize(cacheDir: string, propMapDir: string) {
  return spawnSync(
    "node",
    [script, "finalize", "--cache-dir", cacheDir, "--prop-map-dir", propMapDir],
    { cwd: root, encoding: "utf-8" },
  );
}

function stageFixture(name: string) {
  const src = path.join(fixtures, name);
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), `figma-props-${name}-`));
  const propMapDir = path.join(cacheDir, "out-prop-map");
  for (const file of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, file), path.join(cacheDir, file));
  }
  return { cacheDir, propMapDir };
}

let failed = 0;

{
  const { cacheDir, propMapDir } = stageFixture("bad-no-mapping-kind");
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("mappingKind");
  if (!ok) {
    failed += 1;
    console.error("✗ bad-no-mapping-kind (expected FAIL missing mappingKind)");
    console.error(output);
  } else {
    console.log("✓ bad-no-mapping-kind → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const outFile = path.join(propMapDir, "Button.json");
  const written = fs.existsSync(outFile);
  let hasMappingKind = false;
  if (written) {
    const parsed = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    hasMappingKind = parsed.props?.Size?.mappingKind === "direct";
  }
  const ok = result.status === 0 && output.includes("✅") && written && hasMappingKind;
  if (!ok) {
    failed += 1;
    console.error("✗ good-matched (expected PASS + Button.json with mappingKind)");
    console.error(output);
  } else {
    console.log("✓ good-matched → PASS");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\n${failed} pressure case(s) failed`);
  process.exit(1);
}

console.log("\nAll figma-props-sync pressure cases ok");

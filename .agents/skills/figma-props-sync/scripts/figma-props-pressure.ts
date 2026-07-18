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
let failed = 0;

function runFinalize(cacheDir: string, propMapDir: string) {
  return spawnSync(
    "node",
    [script, "finalize", "--cache-dir", cacheDir, "--prop-map-dir", propMapDir],
    { cwd: root, encoding: "utf-8" },
  );
}

function runExtract(cacheDir: string, uiDir: string, propMapDir?: string, failOnStale = false) {
  const args = [script, "extract-code", "--cache-dir", cacheDir, "--ui-dir", uiDir];
  if (propMapDir) args.push("--prop-map-dir", propMapDir);
  if (failOnStale) args.push("--fail-on-stale");
  return spawnSync("node", args, { cwd: root, encoding: "utf-8" });
}

{
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-props-stale-map-"));
  const propMapDir = path.join(cacheDir, "prop-map");
  const uiDir = path.join(fixtures, "multi-component");
  fs.mkdirSync(propMapDir);
  fs.writeFileSync(
    path.join(propMapDir, "Input.json"),
    JSON.stringify({
      schemaVersion: 2,
      syncedAt: "2026-07-18T00:00:00.000Z",
      source: { fileKey: "test", definitionHash: "sha256:test" },
      target: {
        component: "Input",
        file: path.join(uiDir, "input.tsx"),
        apiHash: "sha256:stale",
      },
      groups: [
        {
          figmaNodeId: "1:1",
          name: "Input",
          mappings: [
            {
              figmaProp: "State",
              figmaType: "VARIANT",
              mappingKind: "composition",
              confidence: "high",
              note: "fixture",
            },
          ],
        },
      ],
    }),
  );
  const result = runExtract(cacheDir, uiDir, propMapDir, true);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("code API hash changed");
  if (!ok) {
    failed += 1;
    console.error("✗ stale code hash (expected extract --fail-on-stale to FAIL)");
    console.error(output);
  } else {
    console.log("✓ stale code hash → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-props-non-v2-map-"));
  const propMapDir = path.join(cacheDir, "prop-map");
  const uiDir = path.join(fixtures, "multi-component");
  fs.mkdirSync(propMapDir);
  fs.writeFileSync(
    path.join(propMapDir, "Input.json"),
    JSON.stringify({ codeComponent: "Input", props: {} }),
  );
  const result = runExtract(cacheDir, uiDir, propMapDir, true);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("schemaVersion 2 required");
  if (!ok) {
    failed += 1;
    console.error("✗ committed non-v2 map (expected hard FAIL)");
    console.error(output);
  } else {
    console.log("✓ committed non-v2 map → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
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

function expectFinalizeFailure(name: string, expectedText: string) {
  const { cacheDir, propMapDir } = stageFixture(name);
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes(expectedText);
  if (!ok) {
    failed += 1;
    console.error(`✗ ${name} (expected FAIL containing ${expectedText})`);
    console.error(output);
  } else {
    console.log(`✓ ${name} → FAIL`);
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

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

expectFinalizeFailure("bad-unknown-react-prop", "missing from code API");
expectFinalizeFailure("bad-value-coverage", "missing Figma values");

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  fs.writeFileSync(
    path.join(cacheDir, "_figma-props-matched.json"),
    JSON.stringify({ fileKey: "abc123", components: [] }),
  );
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("schemaVersion must be 2");
  if (!ok) {
    failed += 1;
    console.error("✗ non-v2 schema rejection (expected hard FAIL)");
    console.error(output);
  } else {
    console.log("✓ non-v2 schema rejection → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-props-multi-component-"));
  const uiDir = path.join(fixtures, "multi-component");
  const result = runExtract(cacheDir, uiDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const codeRawPath = path.join(cacheDir, "_code-props-raw.json");
  let extracted = {} as Record<string, { props?: Record<string, unknown> }>;
  if (fs.existsSync(codeRawPath)) {
    extracted = JSON.parse(fs.readFileSync(codeRawPath, "utf-8")).components ?? {};
  }
  const ok =
    result.status === 0 &&
    extracted.Input?.props?.forceState != null &&
    extracted.TextField?.props?.label != null &&
    extracted.TextField?.props?.required != null;
  if (!ok) {
    failed += 1;
    console.error("✗ multi-component extraction (expected Input + TextField local props)");
    console.error(output);
  } else {
    console.log("✓ multi-component extraction → PASS");
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
    hasMappingKind =
      parsed.schemaVersion === 2 &&
      parsed.groups?.[0]?.mappings?.[0]?.mappingKind === "direct" &&
      typeof parsed.target?.apiHash === "string" &&
      typeof parsed.source?.definitionHash === "string";
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

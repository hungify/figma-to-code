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

function runFinalize(cacheDir: string, propMapDir: string, pruneManifest?: string) {
  const args = [script, "finalize", "--cache-dir", cacheDir, "--prop-map-dir", propMapDir];
  if (pruneManifest !== undefined) {
    args.push("--prune");
    if (pruneManifest) args.push("--prune-manifest", pruneManifest);
  }
  return spawnSync("node", args, { cwd: root, encoding: "utf-8" });
}

function runExtract(
  cacheDir: string,
  uiDir: string,
  propMapDir?: string,
  failOnStale = false,
  components?: string,
) {
  const args = [script, "extract-code", "--cache-dir", cacheDir, "--ui-dir", uiDir];
  if (propMapDir) args.push("--prop-map-dir", propMapDir);
  if (failOnStale) args.push("--fail-on-stale");
  if (components) args.push("--components", components);
  return spawnSync("node", args, { cwd: root, encoding: "utf-8" });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  const setup = runFinalize(cacheDir, propMapDir);
  const fixture = JSON.parse(
    fs.readFileSync(path.join(fixtures, "good-matched/_figma-props-raw.json"), "utf-8"),
  );
  fixture.components[0].propertyDefinitions.__pressure_stale__ = {
    type: "BOOLEAN",
    defaultValue: false,
  };
  const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-props-source-stale-"));
  const mockPath = path.join(mockDir, "mock-fetch.cjs");
  fs.writeFileSync(
    mockPath,
    `const groups = ${JSON.stringify(fixture.components)};\n` +
      "global.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ nodes: Object.fromEntries(groups.map((group) => [group.figmaNodeId, { document: { id: group.figmaNodeId, name: group.name, type: 'COMPONENT_SET', componentPropertyDefinitions: group.propertyDefinitions } }])) }) });\n",
  );
  const result =
    setup.status === 0
      ? spawnSync(
          "node",
          [script, "verify-source", "--components", "Button", "--prop-map-dir", propMapDir],
          {
            cwd: root,
            encoding: "utf-8",
            env: {
              ...process.env,
              FIGMA_ACCESS_TOKEN: "pressure-token",
              NODE_OPTIONS: `--require=${mockPath}`,
            },
          },
        )
      : setup;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("Figma definition hash changed");
  if (!ok) {
    failed += 1;
    console.error("✗ stale current Figma definition (expected hard FAIL)");
    console.error(output);
  } else {
    console.log("✓ stale current Figma definition → FAIL");
  }
  fs.rmSync(mockDir, { recursive: true, force: true });
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "figma-props-dotenv-"));
  fs.writeFileSync(path.join(cwd, ".env"), "FIGMA_ACCESS_TOKEN=pressure-token\n");
  const env = { ...process.env };
  delete env.FIGMA_ACCESS_TOKEN;
  const result = spawnSync("node", [script, "fetch"], { cwd, env, encoding: "utf-8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok =
    result.status !== 0 &&
    output.includes("Need --file-key and --node-ids") &&
    !output.includes("Missing FIGMA_ACCESS_TOKEN");
  if (!ok) {
    failed += 1;
    console.error("✗ dotenv token loading (expected .env token before argument validation)");
    console.error(output);
  } else {
    console.log("✓ dotenv token loading → PASS");
  }
  fs.rmSync(cwd, { recursive: true, force: true });
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

{
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-props-scoped-map-"));
  const propMapDir = path.join(cacheDir, "prop-map");
  const uiDir = path.join(fixtures, "multi-component");
  fs.mkdirSync(propMapDir);
  const extracted = runExtract(cacheDir, uiDir);
  if (extracted.status !== 0) throw new Error("scoped-map fixture extraction failed");
  const codeRaw = JSON.parse(fs.readFileSync(path.join(cacheDir, "_code-props-raw.json"), "utf-8"));
  const input = codeRaw.components.Input;
  fs.writeFileSync(
    path.join(propMapDir, "Input.json"),
    JSON.stringify({
      schemaVersion: 2,
      syncedAt: "2026-07-18T00:00:00.000Z",
      source: { fileKey: "test", definitionHash: "sha256:test" },
      target: { component: "Input", file: input.file, apiHash: input.codeApiHash },
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
  fs.writeFileSync(path.join(propMapDir, "Unrelated.json"), "{ invalid");
  const result = runExtract(cacheDir, uiDir, propMapDir, true, "Input");
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status === 0 && !output.includes("Unrelated.json");
  if (!ok) {
    failed += 1;
    console.error("✗ scoped prop-map check (expected unrelated stale map ignored)");
    console.error(output);
  } else {
    console.log("✓ scoped prop-map check ignores unrelated stale map → PASS");
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

{
  const uiDir = path.join(fixtures, "multi-component");
  const missing = spawnSync("node", [script, "extract-code", "--ui-dir", uiDir], {
    cwd: root,
    encoding: "utf-8",
  });
  const shared = spawnSync(
    "node",
    [script, "extract-code", "--cache-dir", ".figma/cache", "--ui-dir", uiDir],
    { cwd: root, encoding: "utf-8" },
  );
  const missingOutput = `${missing.stdout ?? ""}\n${missing.stderr ?? ""}`;
  const sharedOutput = `${shared.stdout ?? ""}\n${shared.stderr ?? ""}`;
  const ok =
    missing.status !== 0 &&
    missingOutput.includes("requires isolated --cache-dir") &&
    shared.status !== 0 &&
    sharedOutput.includes("Shared cache .figma/cache is forbidden");
  if (!ok) {
    failed += 1;
    console.error("✗ isolated cache guard (expected missing/shared cache rejection)");
    console.error(missingOutput);
    console.error(sharedOutput);
  } else {
    console.log("✓ isolated cache guard → PASS");
  }
}

{
  const cycleA = stageFixture("good-matched");
  const cycleB = stageFixture("good-matched");
  const cycleBMatchedPath = path.join(cycleB.cacheDir, "_figma-props-matched.json");
  const cycleBMatched = JSON.parse(fs.readFileSync(cycleBMatchedPath, "utf-8"));
  cycleBMatched.components[0].groups[0].mappings[0].reactProp = "missingFromCodeApi";
  fs.writeFileSync(cycleBMatchedPath, JSON.stringify(cycleBMatched));

  const resultA = runFinalize(cycleA.cacheDir, cycleA.propMapDir);
  const resultB = runFinalize(cycleB.cacheDir, cycleB.propMapDir);
  const outputB = `${resultB.stdout ?? ""}\n${resultB.stderr ?? ""}`;
  const ok =
    resultA.status === 0 &&
    fs.existsSync(path.join(cycleA.propMapDir, "Button.json")) &&
    resultB.status !== 0 &&
    outputB.includes("missing from code API");
  if (!ok) {
    failed += 1;
    console.error("✗ interleaved isolated cycles (expected A PASS and B independent FAIL)");
    console.error(`${resultA.stdout ?? ""}\n${resultA.stderr ?? ""}`);
    console.error(outputB);
  } else {
    console.log("✓ interleaved isolated cycles → PASS");
  }
  fs.rmSync(cycleA.cacheDir, { recursive: true, force: true });
  fs.rmSync(cycleB.cacheDir, { recursive: true, force: true });
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
  const matchedPath = path.join(cacheDir, "_figma-props-matched.json");
  const matched = JSON.parse(fs.readFileSync(matchedPath, "utf-8"));
  fs.writeFileSync(matchedPath, JSON.stringify(matched));
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status === 0;
  if (!ok) {
    failed += 1;
    console.error("✗ note-only composition mapping (expected PASS for developer review)");
    console.error(output);
  } else {
    console.log("✓ note-only composition mapping → PASS");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  const matchedPath = path.join(cacheDir, "_figma-props-matched.json");
  const codePath = path.join(cacheDir, "_code-props-raw.json");
  const matched = JSON.parse(fs.readFileSync(matchedPath, "utf-8"));
  const codeRaw = JSON.parse(fs.readFileSync(codePath, "utf-8"));
  delete matched.components[0].groups[0].mappings[0].valueMap;
  delete codeRaw.components.Button.props.size.values;
  codeRaw.components.Button.props.size.type = "string";
  fs.writeFileSync(codePath, JSON.stringify(codeRaw));
  fs.writeFileSync(matchedPath, JSON.stringify(matched));
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok =
    result.status !== 0 &&
    output.includes("direct enumerable mapping cannot prove code values; full valueMap required");
  if (!ok) {
    failed += 1;
    console.error("✗ direct mapping with unknown code domain (expected hard FAIL)");
    console.error(output);
  } else {
    console.log("✓ direct mapping with unknown code domain → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  const matchedPath = path.join(cacheDir, "_figma-props-matched.json");
  const codePath = path.join(cacheDir, "_code-props-raw.json");
  const matched = JSON.parse(fs.readFileSync(matchedPath, "utf-8"));
  const codeRaw = JSON.parse(fs.readFileSync(codePath, "utf-8"));
  codeRaw.components.Button.props.showPrepend = { source: "local", type: "boolean" };
  matched.components[0].groups[0].mappings[1] = {
    figmaProp: "Show prepend#101:10",
    figmaType: "BOOLEAN",
    mappingKind: "direct",
    confidence: "high",
    reactProp: "showPrepend",
    evidence: [{ kind: "code-api", reactProp: "showPrepend" }],
  };
  fs.writeFileSync(codePath, JSON.stringify(codeRaw));
  fs.writeFileSync(matchedPath, JSON.stringify(matched));
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const outputMapPath = path.join(propMapDir, "Button.json");
  const outputMap = fs.existsSync(outputMapPath)
    ? JSON.parse(fs.readFileSync(outputMapPath, "utf-8"))
    : null;
  const booleanMapping = outputMap?.groups?.[0]?.mappings?.find(
    (mapping: { figmaProp?: string }) => mapping.figmaProp === "Show prepend#101:10",
  );
  const ok =
    result.status === 0 &&
    booleanMapping?.mappingKind === "direct" &&
    booleanMapping?.reactProp === "showPrepend" &&
    !("valueMap" in booleanMapping);
  if (!ok) {
    failed += 1;
    console.error("✗ implicit BOOLEAN to React boolean mapping (expected PASS)");
    console.error(output);
  } else {
    console.log("✓ implicit BOOLEAN to React boolean mapping → PASS");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  const matchedPath = path.join(cacheDir, "_figma-props-matched.json");
  const matched = JSON.parse(fs.readFileSync(matchedPath, "utf-8"));
  matched.components[0].groups[0].mappings[0] = {
    figmaProp: "Size",
    figmaType: "VARIANT",
    mappingKind: "unmapped",
    confidence: "high",
    note: "Pretend there is no matching code prop.",
  };
  fs.writeFileSync(matchedPath, JSON.stringify(matched));
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("exact code prop candidate exists [size]");
  if (!ok) {
    failed += 1;
    console.error("✗ obvious exact prop hidden as unmapped (expected hard FAIL)");
    console.error(output);
  } else {
    console.log("✓ obvious exact prop hidden as unmapped → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  const matchedPath = path.join(cacheDir, "_figma-props-matched.json");
  const matched = JSON.parse(fs.readFileSync(matchedPath, "utf-8"));
  matched.components[0].groups[0].mappings = matched.components[0].groups[0].mappings.slice(0, 1);
  fs.writeFileSync(matchedPath, JSON.stringify(matched));
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("missing Figma properties");
  if (!ok) {
    failed += 1;
    console.error("✗ omitted Figma property (expected hard FAIL)");
    console.error(output);
  } else {
    console.log("✓ omitted Figma property → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  const matchedPath = path.join(cacheDir, "_figma-props-matched.json");
  const matched = JSON.parse(fs.readFileSync(matchedPath, "utf-8"));
  delete matched.components[0].groups[0].mappings[0].valueMap;
  fs.writeFileSync(matchedPath, JSON.stringify(matched));
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("full valueMap required");
  if (!ok) {
    failed += 1;
    console.error("✗ direct mapping without required valueMap (expected hard FAIL)");
    console.error(output);
  } else {
    console.log("✓ direct mapping without required valueMap → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  const matchedPath = path.join(cacheDir, "_figma-props-matched.json");
  const codePath = path.join(cacheDir, "_code-props-raw.json");
  const matched = JSON.parse(fs.readFileSync(matchedPath, "utf-8"));
  const codeRaw = JSON.parse(fs.readFileSync(codePath, "utf-8"));
  const original = codeRaw.components.Button;
  const alternateFile = "src/components/ui/alternate-button.tsx";
  codeRaw.components = {
    [`${original.file}#Button`]: original,
    [`${alternateFile}#Button`]: { ...original, file: alternateFile },
  };
  codeRaw.componentIndex = { Button: Object.keys(codeRaw.components) };
  matched.components.push({ ...structuredClone(matched.components[0]), codeFile: alternateFile });
  fs.writeFileSync(codePath, JSON.stringify(codeRaw));
  fs.writeFileSync(matchedPath, JSON.stringify(matched));
  const result = runFinalize(cacheDir, propMapDir);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status !== 0 && output.includes("duplicate codeComponent would overwrite");
  if (!ok) {
    failed += 1;
    console.error("✗ duplicate codeComponent output (expected hard FAIL)");
    console.error(output);
  } else {
    console.log("✓ duplicate codeComponent output → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

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
  fs.mkdirSync(propMapDir, { recursive: true });
  const existingMap = path.join(propMapDir, "Existing.json");
  fs.writeFileSync(existingMap, "{}\n");
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
  const ok =
    result.status === 0 &&
    output.includes("Existing prop maps preserved") &&
    written &&
    hasMappingKind &&
    fs.existsSync(existingMap);
  if (!ok) {
    failed += 1;
    console.error("✗ good-matched (expected PASS + Button.json with mappingKind)");
    console.error(output);
  } else {
    console.log("✓ good-matched → PASS");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  fs.mkdirSync(propMapDir, { recursive: true });
  const obsoleteMap = path.join(propMapDir, "Obsolete.json");
  fs.writeFileSync(obsoleteMap, "{}\n");
  const result = runFinalize(cacheDir, propMapDir, "");
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok =
    result.status !== 0 && output.includes("--prune is disabled") && fs.existsSync(obsoleteMap);
  if (!ok) {
    failed += 1;
    console.error("✗ prune without manifest (expected disabled FAIL)");
    console.error(output);
  } else {
    console.log("✓ prune without manifest → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

{
  const { cacheDir, propMapDir } = stageFixture("good-matched");
  fs.mkdirSync(propMapDir, { recursive: true });
  const obsoleteMap = path.join(propMapDir, "Obsolete.json");
  fs.writeFileSync(obsoleteMap, "{}\n");
  const manifestPath = path.join(cacheDir, "complete-library.json");
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ schemaVersion: 1, components: ["Button"] })}\n`,
  );
  const result = runFinalize(cacheDir, propMapDir, manifestPath);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok =
    result.status !== 0 && output.includes("--prune is disabled") && fs.existsSync(obsoleteMap);
  if (!ok) {
    failed += 1;
    console.error("✗ prune with manifest (expected disabled FAIL)");
    console.error(output);
  } else {
    console.log("✓ prune with manifest → FAIL");
  }
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\n${failed} pressure case(s) failed`);
  process.exit(1);
}

console.log("\nAll figma-props-sync pressure cases ok");
